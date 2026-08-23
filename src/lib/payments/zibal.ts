import type {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './types';

/** درگاه زیبال */
export class ZibalGateway implements PaymentGateway {
  readonly id = 'zibal';
  readonly title = 'زیبال';

  private get merchant() {
    const m = process.env.ZIBAL_MERCHANT;
    if (!m) throw new Error('ZIBAL_MERCHANT تنظیم نشده است.');
    return m;
  }

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    const res = await fetch('https://gateway.zibal.ir/v1/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: this.merchant,
        amount: Number(input.amount),
        callbackUrl: input.callbackUrl,
        description: input.description,
        orderId: input.orderId,
        mobile: input.mobile ?? undefined,
      }),
    });

    const json = (await res.json()) as { result?: number; trackId?: number; message?: string };

    if (json.result !== 100 || !json.trackId) {
      throw new Error(json.message || 'خطا در ایجاد تراکنش زیبال');
    }

    return {
      providerRef: String(json.trackId),
      redirectUrl: `https://gateway.zibal.ir/start/${json.trackId}`,
      raw: json,
    };
  }

  async verify(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    if (input.callbackParams.success === '0') {
      return { success: false, failureCode: 'CANCELLED', failureMessage: 'پرداخت ناموفق بود.' };
    }

    const res = await fetch('https://gateway.zibal.ir/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: this.merchant, trackId: Number(input.providerRef) }),
    });

    const json = (await res.json()) as {
      result?: number;
      refNumber?: string | number;
      cardNumber?: string;
      amount?: number;
      message?: string;
    };

    // ۱۰۰ = موفق، ۲۰۱ = قبلاً تأیید شده
    if (json.result === 100 || json.result === 201) {
      // اعتبارسنجی مبلغ سمت سرور
      if (json.amount !== undefined && BigInt(json.amount) !== input.amount) {
        return {
          success: false,
          failureCode: 'AMOUNT_MISMATCH',
          failureMessage: 'مبلغ تأییدشده با مبلغ درخواستی مطابقت ندارد.',
          raw: json,
        };
      }
      return {
        success: true,
        verifyRef: String(json.refNumber ?? input.providerRef),
        cardPan: json.cardNumber,
        raw: json,
      };
    }

    return {
      success: false,
      failureCode: String(json.result ?? 'UNKNOWN'),
      failureMessage: json.message || 'تأیید پرداخت ناموفق بود.',
      raw: json,
    };
  }

  extractRef(params: Record<string, string>) {
    return params.trackId || null;
  }
}
