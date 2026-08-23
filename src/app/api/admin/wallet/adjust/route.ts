import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { mutateWalletStandalone } from '@/lib/wallet';
import { notify } from '@/lib/notifications';
import { handleApiError, ok } from '@/lib/api';
import { adminWalletAdjustSchema } from '@/lib/validation';
import { formatToman, tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';

/** افزایش/کاهش دستی موجودی کیف پول توسط مدیر — همیشه در دفتر کل ثبت می‌شود */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const input = adminWalletAdjustSchema.parse(body);

    const rial = tomanToRial(input.amountToman);
    const signed = input.direction === 'CREDIT' ? rial : -rial;

    const result = await mutateWalletStandalone({
      userId: input.userId,
      amount: signed,
      type: input.direction === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      description: input.description || 'اصلاح موجودی توسط مدیریت',
      performedBy: admin.id,
      // کاهش دستی می‌تواند موجودی را منفی کند (اصلاح خطای مالی)
      allowNegative: input.direction === 'DEBIT',
      metadata: { adminId: admin.id, adminUsername: admin.username },
    });

    await notify({
      userId: input.userId,
      type: 'GENERAL',
      title: input.direction === 'CREDIT' ? 'کیف پول شما شارژ شد 💳' : 'موجودی کیف پول شما تغییر کرد',
      body: `${formatToman(rial)} توسط مدیریت باشگاه ${input.direction === 'CREDIT' ? 'به کیف پول شما اضافه' : 'از کیف پول شما کسر'} شد.`,
      actionUrl: '/wallet',
    });

    return ok({ balance: result.balance, transactionId: result.transactionId });
  } catch (error) {
    return handleApiError(error);
  }
}
