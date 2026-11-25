import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { getVapidKeys } from '@/lib/push';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** کلید عمومی برای ساخت اشتراک در مرورگر + تعداد گوشی‌های فعال کاربر */
export async function GET() {
  try {
    const user = await requireUser();
    const [keys, devices] = await Promise.all([
      getVapidKeys(),
      prisma.pushSubscription.count({ where: { userId: user.id } }),
    ]);
    return ok({ publicKey: keys.publicKey, devices });
  } catch (error) {
    return handleApiError(error);
  }
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((v) => v.startsWith('https://'), 'آدرس اشتراک نامعتبر است.'),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(8).max(100),
  }),
});

/** ثبت گوشی برای دریافت اعلان */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = subscriptionSchema.parse(await req.json());

    /* یک endpoint یعنی یک مرورگر؛ اگر کاربر دیگری روی همین گوشی وارد شود،
       اشتراک به حساب تازه منتقل می‌شود تا اعلانِ نفر قبلی به او نرسد. */
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        userId: user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
      create: {
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
    });
    return ok({ subscribed: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** خاموش کردن اعلان روی همین گوشی */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await req.json());
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
    return ok({ subscribed: false });
  } catch (error) {
    return handleApiError(error);
  }
}
