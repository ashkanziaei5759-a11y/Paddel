import 'server-only';
import webpush from 'web-push';
import { prisma } from './db';
import { appUrl } from './app-url';

/**
 * اعلان روی گوشی (Web Push).
 *
 * مرورگر گوشی یک «اشتراک» به ما می‌دهد؛ برای فرستادن اعلان، پیام رمزشده را
 * به سرور اعلانِ همان مرورگر (گوگل برای اندروید/کروم، اپل برای آیفون) می‌دهیم
 * و او به گوشی می‌رساند — حتی وقتی اپ بسته است.
 *
 * کلیدهای VAPID (امضای سرور ما) اگر در .env نباشند، بار اول ساخته و در
 * پایگاه داده نگه داشته می‌شوند تا روی سرورهای موجود هم بدون تنظیم کار کند.
 */

const VAPID_SETTING = 'push.vapid';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cached: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;

  const fromEnv = {
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? '',
  };
  if (fromEnv.publicKey && fromEnv.privateKey) {
    cached = fromEnv;
    return cached;
  }

  const existing = await prisma.appSetting.findUnique({ where: { key: VAPID_SETTING } });
  if (isKeys(existing?.value)) {
    cached = existing.value;
    return cached;
  }

  /* چند نسخه‌ی هم‌زمان (cluster) ممکن است با هم به این‌جا برسند. upsert با
     update خالی یعنی فقط اولی می‌نویسد؛ بعد همه همان ردیف را می‌خوانند. */
  const generated = webpush.generateVAPIDKeys();
  await prisma.appSetting.upsert({
    where: { key: VAPID_SETTING },
    update: {},
    create: {
      key: VAPID_SETTING,
      value: { publicKey: generated.publicKey, privateKey: generated.privateKey },
      description: 'کلیدهای اعلان گوشی — تغییرشان همه‌ی اشتراک‌ها را بی‌اعتبار می‌کند',
    },
  });
  const saved = await prisma.appSetting.findUnique({ where: { key: VAPID_SETTING } });
  if (!isKeys(saved?.value)) throw new Error('VAPID keys could not be stored');
  cached = saved.value;
  return cached;
}

function isKeys(value: unknown): value is VapidKeys {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as VapidKeys).publicKey === 'string' &&
    typeof (value as VapidKeys).privateKey === 'string'
  );
}

function subject(): string {
  const url = appUrl();
  if (url?.startsWith('https://')) return url;
  return `mailto:${process.env.PUSH_CONTACT_EMAIL?.trim() || 'admin@example.com'}`;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string | null;
  image?: string | null;
  /** اعلان‌های هم‌برچسب روی هم جایگزین می‌شوند، نه این‌که انباشته شوند */
  tag?: string;
}

/** آدرس نسبی تصویر برای گوشی کامل می‌شود */
function absolute(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = appUrl();
  return base ? `${base}${url.startsWith('/') ? '' : '/'}${url}` : undefined;
}

/**
 * ارسال به همه‌ی گوشی‌های چند کاربر.
 * خطای یک گوشی بقیه را متوقف نمی‌کند؛ اشتراکِ منقضی (۴۰۴/۴۱۰) پاک می‌شود.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(userIds)] } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const keys = await getVapidKeys();
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/notifications',
    image: absolute(payload.image),
    tag: payload.tag,
  });
  const options: webpush.RequestOptions = {
    vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
    TTL: 60 * 60 * 24,
    timeout: 10_000,
    /* سرورهای داخل ایران گاهی به سرور اعلان گوگل/اپل دسترسی ندارند */
    ...(process.env.PUSH_PROXY?.trim() ? { proxy: process.env.PUSH_PROXY.trim() } : {}),
  };

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];
  const delivered: string[] = [];

  /* حداکثر ۲۰ ارسال هم‌زمان — اطلاعیه‌ی همگانی هزاران اشتراک دارد */
  const queue = [...subs];
  const worker = async () => {
    for (let sub = queue.shift(); sub; sub = queue.shift()) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          options,
        );
        sent += 1;
        delivered.push(sub.id);
      } catch (error) {
        failed += 1;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.id);
        else console.warn('[push] send failed:', status ?? (error as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(20, subs.length) }, worker));

  if (expired.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
  if (delivered.length) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: delivered } },
      data: { lastUsedAt: new Date() },
    });
  }
  return { sent, failed };
}
