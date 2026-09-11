import type {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './types';
import { GATEWAY_TIMEOUT_MS, gatewayPost } from './http';

/** درگاه نکست‌پی */
export class NextpayGateway implements PaymentGateway {
  readonly id = 'nextpay';
  readonly title = 'نکست‌پی';

  private get apiKey() {
    const k = process.env.NEXTPAY_API_KEY;
    if (!k) throw new Error('NEXTPAY_API_KEY تنظیم نشده است.');
    return k;
  }

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    const json = await gatewayPost<{ code?: number; trans_id?: string }>(
      'https://nextpay.org/nx/gateway/token',
      {
        gateway: 'nextpay',
        timeoutMs: GATEWAY_TIMEOUT_MS.init,
        body: {
          api_key: this.apiKey,
          order_id: input.orderId,
          amount: Number(input.amount),
          callback_uri: input.callbackUrl,
          currency: 'IRR',
          customer_phone: input.mobile ?? undefined,
          payer_desc: input.description,
        },
      },
    );

    if (json.code !== -1 || !json.trans_id) {
      throw new Error('خطا در ایجاد تراکنش نکست‌پی');
    }

    return {
      providerRef: json.trans_id,
      redirectUrl: `https://nextpay.org/nx/gateway/payment/${json.trans_id}`,
      raw: json,
    };
  }

  async verify(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    const json = await gatewayPost<{
      code?: number;
      Shaparak_Ref_Id?: string;
      card_holder?: string;
      amount?: number;
    }>('https://nextpay.org/nx/gateway/verify', {
      gateway: 'nextpay',
      timeoutMs: GATEWAY_TIMEOUT_MS.verify,
      retries: 1,
      body: {
        api_key: this.apiKey,
        trans_id: input.providerRef,
        amount: Number(input.amount),
        currency: 'IRR',
      },
    });

    if (json.code === 0) {
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
        verifyRef: json.Shaparak_Ref_Id || input.providerRef,
        cardPan: json.card_holder,
        raw: json,
      };
    }

    return {
      success: false,
      failureCode: String(json.code ?? 'UNKNOWN'),
      failureMessage: 'تأیید پرداخت ناموفق بود.',
      raw: json,
    };
  }

  extractRef(params: Record<string, string>) {
    return params.trans_id || null;
  }
}
