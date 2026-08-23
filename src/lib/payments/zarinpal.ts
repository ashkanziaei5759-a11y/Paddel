import type {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './types';

/** درگاه زرین‌پال — REST API نسخه‌ی ۴ */
export class ZarinpalGateway implements PaymentGateway {
  readonly id = 'zarinpal';
  readonly title = 'زرین‌پال';

  private get merchantId() {
    const id = process.env.ZARINPAL_MERCHANT_ID;
    if (!id) throw new Error('ZARINPAL_MERCHANT_ID تنظیم نشده است.');
    return id;
  }

  private get sandbox() {
    return process.env.ZARINPAL_SANDBOX === 'true';
  }

  private get apiBase() {
    return this.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  }

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    const res = await fetch(`${this.apiBase}/pg/v4/payment/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: Number(input.amount),
        currency: 'IRR',
        description: input.description,
        callback_url: input.callbackUrl,
        metadata: { mobile: input.mobile ?? undefined, order_id: input.orderId },
      }),
    });

    const json = (await res.json()) as {
      data?: { code?: number; authority?: string; message?: string };
      errors?: { code?: number; message?: string };
    };

    const authority = json.data?.authority;
    if (json.data?.code !== 100 || !authority) {
      const msg = json.errors?.message || json.data?.message || 'خطا در ایجاد تراکنش زرین‌پال';
      throw new Error(msg);
    }

    return {
      providerRef: authority,
      redirectUrl: `${this.apiBase}/pg/StartPay/${authority}`,
      raw: json,
    };
  }

  async verify(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    if (input.callbackParams.Status && input.callbackParams.Status !== 'OK') {
      return { success: false, failureCode: 'CANCELLED', failureMessage: 'پرداخت توسط کاربر لغو شد.' };
    }

    const res = await fetch(`${this.apiBase}/pg/v4/payment/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: Number(input.amount),
        authority: input.providerRef,
      }),
    });

    const json = (await res.json()) as {
      data?: { code?: number; ref_id?: number; card_pan?: string; message?: string };
      errors?: { code?: number; message?: string };
    };

    // ۱۰۰ = موفق، ۱۰۱ = قبلاً تأیید شده
    if (json.data?.code === 100 || json.data?.code === 101) {
      return {
        success: true,
        verifyRef: String(json.data.ref_id ?? ''),
        cardPan: json.data.card_pan,
        raw: json,
      };
    }

    return {
      success: false,
      failureCode: String(json.errors?.code ?? json.data?.code ?? 'UNKNOWN'),
      failureMessage: json.errors?.message || json.data?.message || 'تأیید پرداخت ناموفق بود.',
      raw: json,
    };
  }

  extractRef(params: Record<string, string>) {
    return params.Authority || params.authority || null;
  }
}
