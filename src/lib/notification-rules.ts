import 'server-only';
import { createHash } from 'node:crypto';
import type { NotificationRule, NotificationType } from '@prisma/client';
import { prisma } from './db';
import { sendPush } from './push';
import { formatJalaliDate, formatTime, minutesOfDay, toFaDigits } from './datetime';
import { formatToman } from './utils';

/**
 * موتور اعلان‌های خودکار.
 *
 * هر دقیقه اجرا می‌شود (src/instrumentation.ts) و برای هر قانونِ فعال،
 * کاربرانی را که شرط برایشان برقرار است پیدا می‌کند. جدول deliveries با کلید
 * یکتای (قانون، کاربر، رویداد) تضمین می‌کند هیچ‌کس یک پیام را دو بار نگیرد —
 * حتی اگر چند نسخه‌ی سرور هم‌زمان اجرا کنند یا اجرایی از دست برود.
 */

/** متغیرهای متن پیام: {name} {court} {time} {date} {balance} {days} */
type Vars = Partial<Record<'name' | 'court' | 'time' | 'date' | 'balance' | 'days', string>>;

export function renderTemplate(template: string, vars: Vars): string {
  return template.replace(/\{(name|court|time|date|balance|days)\}/g, (_, key: keyof Vars) => vars[key] ?? '');
}

interface Candidate {
  userId: string;
  refKey: string;
  vars: Vars;
  /** لینک اختصاصی (مثلاً صفحه‌ی همان رزرو) وقتی قانون لینک ندارد */
  url?: string;
}

const TYPE_BY_TRIGGER: Record<NotificationRule['trigger'], NotificationType> = {
  BEFORE_BOOKING: 'BOOKING_REMINDER',
  AFTER_BOOKING: 'ADMIN_MESSAGE',
  INACTIVE_PLAYER: 'ADMIN_MESSAGE',
  LOW_WALLET: 'ADMIN_MESSAGE',
  SCHEDULED: 'CLUB_NEWS',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** پیام‌های تبلیغاتی/یادآوری عمومی نیمه‌شب فرستاده نمی‌شوند (۱۰ صبح تا ۹ شب) */
function isDaytime(now: Date): boolean {
  const m = minutesOfDay(now);
  return m >= 10 * 60 && m < 21 * 60;
}

async function candidatesFor(rule: NotificationRule, now: Date): Promise<Candidate[]> {
  switch (rule.trigger) {
    case 'BEFORE_BOOKING': {
      const bookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          startsAt: { gt: now, lte: new Date(now.getTime() + rule.offset * 60_000) },
          user: { role: 'PLAYER', status: 'ACTIVE' },
        },
        select: {
          id: true,
          userId: true,
          startsAt: true,
          court: { select: { name: true } },
          user: { select: { profile: { select: { firstName: true } } } },
        },
        take: 2000,
      });
      return bookings.map((b) => ({
        userId: b.userId,
        refKey: `booking:${b.id}`,
        url: `/bookings/${b.id}`,
        vars: {
          name: b.user.profile?.firstName ?? '',
          court: b.court.name,
          time: formatTime(b.startsAt),
          date: formatJalaliDate(b.startsAt, { withWeekday: true }),
        },
      }));
    }

    case 'AFTER_BOOKING': {
      const until = new Date(now.getTime() - rule.offset * 60_000);
      /* فقط ۶ ساعت اخیر — قانونِ تازه برای بازی‌های ماه‌های قبل پیام نفرستد */
      const since = new Date(until.getTime() - 6 * 60 * 60_000);
      const bookings = await prisma.booking.findMany({
        where: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          endsAt: { gt: since, lte: until },
          user: { role: 'PLAYER', status: 'ACTIVE' },
        },
        select: {
          id: true,
          userId: true,
          startsAt: true,
          court: { select: { name: true } },
          user: { select: { profile: { select: { firstName: true } } } },
        },
        take: 2000,
      });
      return bookings.map((b) => ({
        userId: b.userId,
        refKey: `booking:${b.id}`,
        url: `/bookings/${b.id}`,
        vars: {
          name: b.user.profile?.firstName ?? '',
          court: b.court.name,
          time: formatTime(b.startsAt),
          date: formatJalaliDate(b.startsAt, { withWeekday: true }),
        },
      }));
    }

    case 'INACTIVE_PLAYER': {
      if (!isDaytime(now)) return [];
      const days = Math.max(1, rule.offset);
      const cut = new Date(now.getTime() - days * DAY_MS);
      const users = await prisma.user.findMany({
        where: {
          role: 'PLAYER',
          status: 'ACTIVE',
          createdAt: { lt: cut },
          bookings: { none: { startsAt: { gte: cut }, status: { not: 'CANCELLED' } } },
        },
        select: { id: true, profile: { select: { firstName: true } } },
        take: 5000,
      });
      /* هر «دوره»ی چندروزه حداکثر یک پیام */
      const period = Math.floor(now.getTime() / (days * DAY_MS));
      return users.map((u) => ({
        userId: u.id,
        refKey: `period:${period}`,
        vars: { name: u.profile?.firstName ?? '', days: toFaDigits(days) },
      }));
    }

    case 'LOW_WALLET': {
      if (!isDaytime(now) || rule.thresholdAmount === null) return [];
      const wallets = await prisma.wallet.findMany({
        where: {
          balance: { lt: rule.thresholdAmount },
          user: { role: 'PLAYER', status: 'ACTIVE' },
        },
        select: { userId: true, balance: true, user: { select: { profile: { select: { firstName: true } } } } },
        take: 5000,
      });
      /* حداکثر هفته‌ای یک بار */
      const week = Math.floor(now.getTime() / (7 * DAY_MS));
      return wallets.map((w) => ({
        userId: w.userId,
        refKey: `week:${week}`,
        vars: { name: w.user.profile?.firstName ?? '', balance: formatToman(w.balance) },
      }));
    }

    case 'SCHEDULED': {
      if (!rule.runAt || rule.runAt > now || rule.lastRunAt) return [];
      const users = await prisma.user.findMany({
        where: { role: 'PLAYER', status: 'ACTIVE' },
        select: { id: true, profile: { select: { firstName: true } } },
      });
      return users.map((u) => ({
        userId: u.id,
        refKey: 'once',
        vars: { name: u.profile?.firstName ?? '' },
      }));
    }
  }
}

async function runRule(rule: NotificationRule, now: Date): Promise<number> {
  const candidates = await candidatesFor(rule, now);

  if (rule.trigger === 'SCHEDULED' && rule.runAt && rule.runAt <= now && !rule.lastRunAt) {
    /* اعلان زمان‌دار فقط یک بار اجرا می‌شود، حتی اگر بازیکنی نباشد */
    await prisma.notificationRule.update({
      where: { id: rule.id },
      data: { lastRunAt: now, isActive: false },
    });
  }
  if (candidates.length === 0) return 0;

  /* ثبت «ارسال‌شده» پیش از ارسال: فقط ردیف‌هایی که واقعاً درج شدند برمی‌گردند،
     پس اجرای هم‌زمانِ دیگر همان کاربران را دوباره نمی‌فرستد. */
  const fresh: Candidate[] = [];
  for (let i = 0; i < candidates.length; i += 1000) {
    const chunk = candidates.slice(i, i + 1000);
    const inserted = await prisma.notificationRuleDelivery.createManyAndReturn({
      data: chunk.map((c) => ({ ruleId: rule.id, userId: c.userId, refKey: c.refKey })),
      skipDuplicates: true,
      select: { userId: true, refKey: true },
    });
    const keys = new Set(inserted.map((d) => `${d.userId}|${d.refKey}`));
    fresh.push(...chunk.filter((c) => keys.has(`${c.userId}|${c.refKey}`)));
  }
  if (fresh.length === 0) return 0;

  const type = TYPE_BY_TRIGGER[rule.trigger];
  const messages = fresh.map((c) => ({
    userId: c.userId,
    title: renderTemplate(rule.title, c.vars),
    body: renderTemplate(rule.body, c.vars),
    url: rule.actionUrl || c.url || '/notifications',
  }));

  const sentAt = new Date();
  await prisma.notification.createMany({
    data: messages.map((m) => ({
      userId: m.userId,
      type,
      title: m.title,
      body: m.body,
      actionUrl: m.url,
      imageUrl: rule.imageUrl,
      channels: ['IN_APP', 'PUSH'],
      data: { ruleId: rule.id },
      sentAt,
    })),
  });

  await prisma.notificationRule.update({
    where: { id: rule.id },
    data: { sentCount: { increment: messages.length }, lastRunAt: now },
  });

  /* اعلان گوشی در پس‌زمینه؛ متن هر نفر فرق دارد (نام، ساعت) پس تک‌به‌تک */
  void (async () => {
    const queue = [...messages];
    const worker = async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        await sendPush([m.userId], { title: m.title, body: m.body, url: m.url, image: rule.imageUrl }).catch(
          () => undefined,
        );
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
  })();

  return messages.length;
}

/**
 * یک دور اجرای همه‌ی قانون‌ها. اگر نسخه‌ی دیگری از سرور در ۵۰ ثانیه‌ی اخیر
 * اجرا کرده باشد، کاری نمی‌کند (قفل سبک در جدول تنظیمات).
 */
export async function runNotificationRules(now = new Date()): Promise<{ ran: boolean; sent: number }> {
  const lease = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO app_settings (key, value, "updatedAt")
    VALUES ('scheduler.lease', '{}'::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET "updatedAt" = now()
    WHERE app_settings."updatedAt" < now() - interval '50 seconds'
    RETURNING key`;
  if (lease.length === 0) return { ran: false, sent: 0 };

  const rules = await prisma.notificationRule.findMany({ where: { isActive: true } });
  let sent = 0;
  for (const rule of rules) {
    try {
      sent += await runRule(rule, now);
    } catch (error) {
      console.error(`[rules] rule ${rule.id} failed:`, error);
    }
  }
  return { ran: true, sent };
}

/**
 * توکن داخلیِ زمان‌بند. اگر CRON_SECRET تعریف نشده باشد، از AUTH_SECRET
 * ساخته می‌شود تا همه‌ی نسخه‌های cluster یک مقدار داشته باشند.
 */
export function schedulerToken(): string | null {
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) return cron;
  const auth = process.env.AUTH_SECRET;
  if (!auth) return null;
  return createHash('sha256').update(`scheduler:${auth}`).digest('hex');
}
