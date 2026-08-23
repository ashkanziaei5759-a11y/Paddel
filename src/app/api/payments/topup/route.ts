import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { getGateway } from '@/lib/payments';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { AppError, fail, handleApiError, ok } from '@/lib/api';
import { topupSchema } from '@/lib/validation';
import { tomanToRial } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

export const runtime = 'nodejs';

const MIN_TOMAN = 10_000;
const MAX_TOMAN = 100_000_000;

/**
 * آغاز شارژ کیف پول.
 * مبلغ سمت سرور اعتبارسنجی و ذخیره می‌شود؛ افزایش موجودی فقط پس از
 * تأیید موفق پرداخت در callback انجام می‌گیرد.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const limited = await rateLimit(
      `topup:${user.id}`,
      RATE_LIMITS.PAYMENT_INIT.limit,
      RATE_LIMITS.PAYMENT_INIT.window,
    );
    if (!limited.allowed) return fail('تعداد درخواست‌های پرداخت زیاد است. کمی بعد تلاش کنید.', 429);

    const body = await req.json();
    const input = topupSchema.parse(body);

    if (input.amountToman < MIN_TOMAN) {
      throw new AppError(
        `حداقل مبلغ شارژ ${toFaDigits(MIN_TOMAN.toLocaleString('en-US'))} تومان است.`,
      );
    }
    if (input.amountToman > MAX_TOMAN) {
      throw new AppError('مبلغ وارد شده بیش از حد مجاز است.');
    }

    const amountRial = tomanToRial(input.amountToman);
    const gateway = getGateway(input.provider);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: gateway.id,
        amount: amountRial,
        status: 'INITIATED',
        description: 'شارژ کیف پول پرشین پدل',
      },
    });

    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const callbackUrl = `${base}/api/payments/callback?paymentId=${payment.id}`;

    try {
      const init = await gateway.init({
        amount: amountRial,
        callbackUrl,
        description: `شارژ کیف پول — ${user.username}`,
        orderId: payment.id,
        mobile: user.phone,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: init.providerRef,
          status: 'PENDING',
          callbackUrl,
          rawInitResponse: init.raw as never,
        },
      });

      return ok({ paymentId: payment.id, redirectUrl: init.redirectUrl });
    } catch (error) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureMsg: error instanceof Error ? error.message : 'خطای نامشخص درگاه',
        },
      });
      throw new AppError(
        error instanceof Error ? error.message : 'ارتباط با درگاه پرداخت برقرار نشد.',
        502,
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
