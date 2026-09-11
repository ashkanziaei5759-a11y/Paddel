import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { handleApiError, ok, AppError } from '@/lib/api';
import { giftVoucherSchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';
import { VOUCHER_KIND_LABEL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * هدیه‌دادن یک بن به بازیکن دیگر.
 *
 * انتقالِ مالکیت است، نه صدور بن تازه: امتیازی جابه‌جا نمی‌شود و تعداد
 * بن‌های در گردش ثابت می‌ماند. قفل ردیف لازم است چون بدون آن، دو درخواستِ
 * هم‌زمان می‌توانستند یک بن را به دو نفر بدهند.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = giftVoucherSchema.parse(await req.json());

    const result = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string; userId: string; status: string; kind: string; expiresAt: Date }[]
        >`
          SELECT id, "userId", status::text, kind::text, "expiresAt"
          FROM "booking_vouchers" WHERE code = ${input.code} FOR UPDATE
        `;

        const voucher = rows[0];
        if (!voucher) throw new AppError('این بن پیدا نشد.', 404);
        if (voucher.userId !== user.id) throw new AppError('این بن متعلق به شما نیست.', 403);
        if (voucher.status !== 'ACTIVE') {
          throw new AppError('فقط بن فعال قابل هدیه‌دادن است.', 409);
        }
        if (voucher.expiresAt.getTime() <= Date.now()) {
          await tx.bookingVoucher.update({
            where: { id: voucher.id },
            data: { status: 'EXPIRED' },
          });
          throw new AppError('اعتبار این بن تمام شده است.', 409);
        }

        const to = await tx.user.findUnique({
          where: { phone: input.phone },
          select: { id: true, status: true, profile: { select: { firstName: true, lastName: true } } },
        });
        if (!to) throw new AppError('بازیکنی با این شماره در باشگاه ثبت نشده است.', 404);
        if (to.id === user.id) throw new AppError('بن را نمی‌توانید به خودتان هدیه دهید.', 400);
        if (to.status !== 'ACTIVE') throw new AppError('حساب این بازیکن فعال نیست.', 409);

        await tx.bookingVoucher.update({
          where: { id: voucher.id },
          data: { userId: to.id, giftedFromId: user.id, giftedAt: new Date() },
        });

        return { to, kind: voucher.kind };
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );

    const from = user.fullName;
    await notify({
      userId: result.to.id,
      type: 'VOUCHER_GIFT_RECEIVED',
      title: 'یک بن هدیه گرفتید',
      body: input.message
        ? `${from} بنِ «${VOUCHER_KIND_LABEL[result.kind as 'FREE_SESSION' | 'PERCENT_DISCOUNT']}» را به شما هدیه داد: «${input.message}»`
        : `${from} بنِ «${VOUCHER_KIND_LABEL[result.kind as 'FREE_SESSION' | 'PERCENT_DISCOUNT']}» را به شما هدیه داد.`,
      actionUrl: '/vouchers',
      data: { code: input.code },
    });

    const name =
      `${result.to.profile?.firstName ?? ''} ${result.to.profile?.lastName ?? ''}`.trim() ||
      'بازیکن';
    return ok({ to: name });
  } catch (error) {
    return handleApiError(error);
  }
}
