import type {
  PaymentGateway,
  PaymentInitInput,
  PaymentInitResult,
  PaymentVerifyInput,
  PaymentVerifyResult,
} from './types';

/**
 * درگاه شبیه‌سازی‌شده برای توسعه و تست.
 * کاربر را به یک صفحه‌ی داخلی هدایت می‌کند که موفق/ناموفق بودن پرداخت را شبیه‌سازی می‌کند.
 * در محیط تولید هرگز نباید فعال باشد.
 */
export class MockGateway implements PaymentGateway {
  readonly id = 'mock';
  readonly title = 'درگاه آزمایشی';

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    const ref = `MOCK-${input.orderId}`;
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = new URL('/payment/mock', base);
    url.searchParams.set('ref', ref);
    url.searchParams.set('amount', String(input.amount));
    url.searchParams.set('callback', input.callbackUrl);
    return { providerRef: ref, redirectUrl: url.toString(), raw: { mock: true } };
  }

  async verify(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    if (input.callbackParams.status === 'failed') {
      return { success: false, failureCode: 'MOCK_FAILED', failureMessage: 'پرداخت آزمایشی ناموفق.' };
    }
    return {
      success: true,
      verifyRef: `MOCKREF-${Date.now()}`,
      cardPan: '6037-****-****-1234',
      raw: { mock: true },
    };
  }

  extractRef(params: Record<string, string>) {
    return params.ref || null;
  }
}
