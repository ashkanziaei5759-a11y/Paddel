import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { mutatePointsStandalone } from '@/lib/points';
import { notify } from '@/lib/notifications';
import { handleApiError, ok } from '@/lib/api';
import { adminPointsAdjustSchema } from '@/lib/validation';
import { toFaDigits } from '@/lib/datetime';

export const runtime = 'nodejs';

/** افزایش/کاهش دستی امتیاز توسط مدیر — با ثبت در دفتر کل امتیاز */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const input = adminPointsAdjustSchema.parse(body);

    const result = await mutatePointsStandalone({
      userId: input.userId,
      amount: input.amount,
      type: input.amount > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      description: input.description || 'اصلاح امتیاز توسط مدیریت',
      performedById: admin.id,
      allowNegative: false,
    });

    await notify({
      userId: input.userId,
      type: 'POINTS_AWARDED',
      title: input.amount > 0 ? 'امتیاز دریافت کردید ⭐' : 'امتیاز شما تغییر کرد',
      body: `${toFaDigits(Math.abs(input.amount))} امتیاز توسط مدیریت باشگاه ${input.amount > 0 ? 'به حساب شما اضافه' : 'از حساب شما کسر'} شد.`,
      actionUrl: '/profile',
    });

    return ok({ points: result.points, transactionId: result.transactionId });
  } catch (error) {
    return handleApiError(error);
  }
}
