import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { convertPointsToWallet } from '@/lib/point-economy';
import { notify } from '@/lib/notifications';
import { toFaDigits } from '@/lib/datetime';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(1, 'بازیکن را انتخاب کنید.'),
  points: z.coerce.number().int().min(1, 'تعداد امتیاز باید مثبت باشد.').max(100_000),
  reason: z.string().trim().max(200).optional(),
});

/**
 * تبدیل امتیاز یک بازیکن به موجودی کیف پولش.
 *
 * دادن و کم کردن دستی امتیاز مسیر جداگانه‌ی خودش را دارد
 * (/api/admin/points/adjust)؛ اینجا فقط تبدیل انجام می‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const limit = await rateLimit(`points-convert:${admin.id}`, 60, 3600);
    if (!limit.allowed) {
      throw new AppError('تعداد تبدیل‌ها در این ساعت زیاد بوده است.', 429);
    }

    const input = schema.parse(await req.json());

    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!target) throw new AppError('بازیکن پیدا نشد.', 404);

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
      body: `${toFaDigits(input.points)} امتیاز به کیف پول شما واریز شد.`,
      actionUrl: '/wallet',
    });

    return ok({
      points: result.points,
      rial: result.rial.toString(),
      balance: result.balance.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
