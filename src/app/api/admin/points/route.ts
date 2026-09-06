import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { mutatePointsStandalone } from '@/lib/points';
import { convertPointsToWallet } from '@/lib/point-economy';
import { notify } from '@/lib/notifications';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(1, 'بازیکن را انتخاب کنید.'),
  /** GRANT و REVOKE امتیاز را جابه‌جا می‌کنند، CONVERT آن را به پول تبدیل می‌کند */
  action: z.enum(['GRANT', 'REVOKE', 'CONVERT']),
  points: z.coerce.number().int().min(1, 'تعداد امتیاز باید مثبت باشد.').max(100_000),
  reason: z.string().trim().max(200).optional(),
});

/**
 * عملیات امتیازی مدیر: دادن، کم کردن، و تبدیل به موجودی کیف پول.
 *
 * همه‌ی مسیرها از دفتر کل امتیاز عبور می‌کنند، پس هر تغییری ردیف تاریخچه
 * دارد و موجودیِ کش‌شده هیچ‌وقت بی‌سند جابه‌جا نمی‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const limit = await rateLimit(`admin-points:${admin.id}`, 60, 3600);
    if (!limit.allowed) {
      throw new AppError('تعداد عملیات امتیازی در این ساعت زیاد بوده است.', 429);
    }

    const input = schema.parse(await req.json());

    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, profile: { select: { points: true } } },
    });
    if (!target) throw new AppError('بازیکن پیدا نشد.', 404);

    if (input.action === 'CONVERT') {
      const result = await convertPointsToWallet({
        adminId: admin.id,
        userId: target.id,
        points: input.points,
        reason: input.reason,
      });

      await notify({
        userId: target.id,
        type: 'WALLET_TOPUP',
        title: 'امتیاز شما به موجودی تبدیل شد',
        body: `${input.points} امتیاز به کیف پول شما واریز شد.`,
        actionUrl: '/wallet',
      });

      return ok({
        action: 'CONVERT',
        points: result.points,
        rial: result.rial.toString(),
        balance: result.balance.toString(),
      });
    }

    const grant = input.action === 'GRANT';
    const result = await mutatePointsStandalone({
      userId: target.id,
      amount: grant ? input.points : -input.points,
      type: grant ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      description: input.reason ?? (grant ? 'امتیاز از سوی باشگاه' : 'کسر امتیاز توسط باشگاه'),
      performedById: admin.id,
    });

    await notify({
      userId: target.id,
      type: 'POINTS_AWARDED',
      title: grant ? 'امتیاز گرفتید 🎉' : 'امتیاز شما کم شد',
      body: grant
        ? `${input.points} امتیاز به حساب شما اضافه شد.`
        : `${input.points} امتیاز از حساب شما کم شد.`,
      actionUrl: '/profile',
    });

    return ok({ action: input.action, points: result.points });
  } catch (error) {
    return handleApiError(error);
  }
}
