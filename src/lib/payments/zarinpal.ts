import type {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './types';
import { GATEWAY_TIMEOUT_MS, gatewayPost } from './http';

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
    const json = await gatewayPost<{
      data?: { code?: number; authority?: string; message?: string };
      errors?: { code?: number; message?: string };
    }>(`${this.apiBase}/pg/v4/payment/request.json`, {
      gateway: 'zarinpal',
      timeoutMs: GATEWAY_TIMEOUT_MS.init,
      body: {
        merchant_id: this.merchantId,
        amount: Number(input.amount),
        currency: 'IRR',
        description: input.description,
        callback_url: input.callbackUrl,
        metadata: { mobile: input.mobile ?? undefined, order_id: input.orderId },
      },
    });

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

    const json = await gatewayPost<{
      data?: { code?: number; ref_id?: number; card_pan?: string; message?: string };
      errors?: { code?: number; message?: string };
    }>(`${this.apiBase}/pg/v4/payment/verify.json`, {
      gateway: 'zarinpal',
      timeoutMs: GATEWAY_TIMEOUT_MS.verify,
      retries: 1,
      body: {
        merchant_id: this.merchantId,
        amount: Number(input.amount),
        authority: input.providerRef,
      },
    });

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
