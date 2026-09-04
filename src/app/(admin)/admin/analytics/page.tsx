import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { BarSeries, DistributionBars, RankBars } from '@/components/admin/charts/Charts';
import { LEVEL_LABEL } from '@/lib/constants';
import { addDays, startOfLocalDay, toFaDigits } from '@/lib/datetime';
import { formatToman, rialToToman } from '@/lib/utils';
import type { PlayerLevel } from '@prisma/client';

export const metadata: Metadata = { title: 'نمودارها' };
export const dynamic = 'force-dynamic';

const DAYS = 14;
const WEEKDAY = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

/**
 * نمودارهای باشگاه.
 *
 * همه‌ی محاسبه‌ها روی سرور انجام می‌شود و خروجی، عددهای آماده است؛ هیچ ردیف
 * خامی به مرورگر نمی‌رود. بازه‌ی زمانی دو هفته است تا هم روند دیده شود و هم
 * پرس‌وجو سبک بماند.
 */
export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  const today = startOfLocalDay(new Date());
  const since = addDays(today, -(DAYS - 1));

  const [bookings, topPlayers, courts, levels, topSpenders] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, totalPrice: true, courtId: true },
    }),
    prisma.profile.findMany({
      where: { user: { role: 'PLAYER', status: 'ACTIVE' } },
      orderBy: { points: 'desc' },
      take: 8,
      select: { userId: true, firstName: true, lastName: true, points: true, level: true },
    }),
    prisma.court.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.profile.groupBy({ by: ['level'], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ['userId'],
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
      _count: { _all: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 8,
    }),
  ]);

  /* پروفایلِ پرخرج‌ترین‌ها را جدا می‌گیریم؛ groupBy نمی‌تواند join بزند */
  const spenderProfiles = await prisma.profile.findMany({
    where: { userId: { in: topSpenders.map((s) => s.userId) } },
    select: { userId: true, firstName: true, lastName: true },
  });
  const nameOf = new Map(
    spenderProfiles.map((p) => [p.userId, `${p.firstName} ${p.lastName}`] as const),
  );

  /* ---- سری‌های روزانه ---- */
  const dayKeys: Date[] = Array.from({ length: DAYS }, (_, i) => addDays(since, i));
  const revenueByDay = new Map<number, bigint>();
  const countByDay = new Map<number, number>();
  const revenueByCourt = new Map<string, bigint>();

  for (const b of bookings) {
    const key = startOfLocalDay(b.createdAt).getTime();
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0n) + b.totalPrice);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    revenueByCourt.set(b.courtId, (revenueByCourt.get(b.courtId) ?? 0n) + b.totalPrice);
  }

  const label = (d: Date) => WEEKDAY[d.getDay()] ?? '';

  const revenuePoints = dayKeys.map((d) => ({
    label: label(d),
    value: Number(rialToToman(revenueByDay.get(d.getTime()) ?? 0n)),
  }));
  const bookingPoints = dayKeys.map((d) => ({
    label: label(d),
    value: countByDay.get(d.getTime()) ?? 0,
  }));

  const levelOrder = Object.keys(LEVEL_LABEL) as PlayerLevel[];
  const levelCounts = new Map(levels.map((l) => [l.level, l._count._all] as const));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-black text-brand-800">نمودارها</h1>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          روند {toFaDigits(DAYS)} روز گذشته و رتبه‌بندی بازیکنان و زمین‌ها.
        </p>
      </header>

      <BarSeries
        title="درآمد روزانه"
        subtitle={`مجموع ${toFaDigits(DAYS)} روز گذشته (تومان)`}
        points={revenuePoints}
        format={(v) => `${toFaDigits(v.toLocaleString('en-US'))}`}
        accent="accent"
      />

      <BarSeries
        title="تعداد رزرو روزانه"
        subtitle="رزروهای ثبت‌شده در هر روز"
        points={bookingPoints}
        format={(v) => toFaDigits(v)}
      />

      <RankBars
        title="بازیکنان برتر"
        subtitle="بر اساس امتیاز رنکینگ"
        rows={topPlayers.map((p) => ({
          id: p.userId,
          name: `${p.firstName} ${p.lastName}`,
          meta: LEVEL_LABEL[p.level],
          value: p.points,
        }))}
        format={(v) => `${toFaDigits(v)} امتیاز`}
        emptyText="هنوز بازیکنی امتیاز نگرفته است."
      />

      <RankBars
        title="بیشترین هزینه‌ی رزرو"
        subtitle="بازیکنانی که بیشترین مبلغ را رزرو کرده‌اند"
        rows={topSpenders.map((s) => ({
          id: s.userId,
          name: nameOf.get(s.userId) ?? '—',
          meta: `${toFaDigits(s._count._all)} رزرو`,
          value: Number(rialToToman(s._sum.totalPrice ?? 0n)),
        }))}
        format={(v) => formatToman(BigInt(v) * 10n)}
        emptyText="هنوز رزروی ثبت نشده است."
      />

      <RankBars
        title="پردرآمدترین زمین‌ها"
        subtitle={`درآمد ${toFaDigits(DAYS)} روز گذشته`}
        rows={courts
          .map((c) => ({
            id: c.id,
            name: c.name,
            value: Number(rialToToman(revenueByCourt.get(c.id) ?? 0n)),
          }))
          .sort((a, b) => b.value - a.value)}
        format={(v) => formatToman(BigInt(v) * 10n)}
        emptyText="زمین فعالی وجود ندارد."
      />

      <DistributionBars
        title="توزیع سطح بازیکنان"
        subtitle="چند بازیکن در هر سطح"
        rows={levelOrder.map((lvl) => ({
          label: LEVEL_LABEL[lvl],
          value: levelCounts.get(lvl) ?? 0,
        }))}
      />
    </div>
  );
}
