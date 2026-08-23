/**
 * قرارداد مشترک درگاه‌های پرداخت.
 * افزودن درگاه جدید = پیاده‌سازی همین رابط + ثبت آن در registry.
 */

export interface PaymentInitInput {
  /** مبلغ به ریال */
  amount: bigint;
  callbackUrl: string;
  description: string;
  /** شناسه‌ی داخلی تراکنش برای پیگیری */
  orderId: string;
  mobile?: string | null;
  email?: string | null;
}

export interface PaymentInitResult {
  /** شناسه‌ی تراکنش نزد درگاه (authority / trackId) */
  providerRef: string;
  /** نشانی برای هدایت کاربر */
  redirectUrl: string;
  raw?: unknown;
}

export interface PaymentVerifyInput {
  providerRef: string;
  amount: bigint;
  /** پارامترهای بازگشتی از درگاه */
  callbackParams: Record<string, string>;
}

export interface PaymentVerifyResult {
  success: boolean;
  /** شناسه‌ی نهایی پرداخت (refId) */
  verifyRef?: string;
  cardPan?: string;
  failureCode?: string;
  failureMessage?: string;
  raw?: unknown;
}

export interface PaymentGateway {
  readonly id: string;
  readonly title: string;
  init(input: PaymentInitInput): Promise<PaymentInitResult>;
  verify(input: PaymentVerifyInput): Promise<PaymentVerifyResult>;
  /** استخراج شناسه‌ی تراکنش از پارامترهای بازگشتی درگاه */
  extractRef(params: Record<string, string>): string | null;
}
