import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getGateway } from '@/lib/payments';
import { mutateWallet } from '@/lib/wallet';
import { notify } from '@/lib/notifications';
import { formatToman } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * بازگشت از درگاه پرداخت.
 * موجودی کیف پول فقط پس از تأیید سمت سرور (verify) و با کلید یکتا افزایش می‌یابد،
 * بنابراین فراخوانی چندباره‌ی این مسیر شارژ تکراری ایجاد نمی‌کند.
 */
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => { params[key] = value; });

  if (req.method === 'POST') {
    try {
      const form = await req.formData();
      form.forEach((value, key) => { params[key] = String(value); });
    } catch {
      /* بدنه‌ی غیر فرم — نادیده گرفته می‌شود */
    }
  }

  const paymentId = params.paymentId;
  const redirect = (status: 'success' | 'failed', message?: string) => {
    const target = new URL('/wallet', base);
    target.searchParams.set('payment', status);
    if (message) target.searchParams.set('message', message);
    return NextResponse.redirect(target, { status: 303 });
  };

  if (!paymentId) return redirect('failed', 'شناسه‌ی پرداخت یافت نشد.');

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return redirect('failed', 'تراکنش یافت نشد.');

  // تراکنش قبلاً تأیید شده — شارژ دوباره انجام نمی‌شود
  if (payment.status === 'SUCCESS') return redirect('success');

  const gateway = getGateway(payment.provider);
  const providerRef = gateway.extractRef(params) || payment.providerRef;

  if (!providerRef) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureMsg: 'شناسه‌ی تراکنش درگاه یافت نشد.' },
    });
    return redirect('failed', 'پرداخت ناموفق بود.');
  }

  try {
    const result = await gateway.verify({
      providerRef,
      amount: payment.amount,
      callbackParams: params,
    });

    if (!result.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: result.failureCode === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
          failureCode: result.failureCode,
          failureMsg: result.failureMessage,
          rawVerifyResponse: result.raw as never,
        },
      });
      return redirect('failed', result.failureMessage || 'پرداخت ناموفق بود.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          providerRef,
          providerVerifyRef: result.verifyRef,
          cardPan: result.cardPan,
          paidAt: new Date(),
          rawVerifyResponse: result.raw as never,
        },
      });

      await mutateWallet(tx, {
        userId: payment.userId,
        amount: payment.amount,
        type: 'TOPUP',
        description: 'شارژ کیف پول از درگاه پرداخت',
        // کلید یکتا: تضمین می‌کند یک پرداخت فقط یک بار شارژ شود
        referenceKey: `payment:${payment.id}`,
        paymentId: payment.id,
        metadata: { provider: payment.provider, verifyRef: result.verifyRef },
      });
    }, { isolationLevel: 'ReadCommitted', timeout: 20_000 });

    await notify({
      userId: payment.userId,
      type: 'WALLET_TOPUP',
      title: 'کیف پول شما شارژ شد 💳',
      body: `مبلغ ${formatToman(payment.amount)} با موفقیت به کیف پول شما اضافه شد.`,
      actionUrl: '/wallet',
      data: { paymentId: payment.id },
    });

    return redirect('success');
  } catch (error) {
    console.error('[payment] verify error:', error);
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureMsg: error instanceof Error ? error.message : 'خطای تأیید پرداخت',
      },
    });
    return redirect('failed', 'خطا در تأیید پرداخت. در صورت کسر وجه با پشتیبانی تماس بگیرید.');
  }
}

export const GET = handle;
export const POST = handle;
