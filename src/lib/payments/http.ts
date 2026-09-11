import 'server-only';
import { AppError } from '@/lib/api';

/**
 * تماس با درگاه پرداخت.
 *
 * چرا این لایه لازم است: `fetch` در Node هیچ مهلت پیش‌فرضی ندارد. اگر شاپرک
 * یا PSP کند شود — که در ساعات شلوغ و هنگام قطعی‌های شبکه‌ی داخلی کم پیش
 * نمی‌آید — درخواست تا ابد باز می‌ماند. هر کاربری که از درگاه برمی‌گردد یک
 * اتصال را برای همیشه اشغال می‌کند و چند نفر کافی‌اند تا کل اپ بخوابد.
 *
 * پس هر تماس مهلت دارد و پاسخ‌هایی که JSON نیستند (صفحه‌ی خطای HTML درگاه،
 * صفحه‌ی فیلترینگ، یا خطای ۵۰۲ لودبالانسر) به‌جای انفجار در `res.json()`،
 * به یک پیام فارسی روشن تبدیل می‌شوند.
 */

/** مهلت تماس با درگاه. صدور تراکنش کوتاه‌تر، تأیید بلندتر. */
export const GATEWAY_TIMEOUT_MS = {
  /** کاربر منتظر نشسته؛ بیشتر از این یعنی درگاه بالا نیست */
  init: 12_000,
  /** تأیید حساس‌تر است: پول کم شده و باید تکلیفش روشن شود */
  verify: 20_000,
} as const;

export interface GatewayFetchOptions {
  body: unknown;
  timeoutMs: number;
  /** نام درگاه، فقط برای پیام خطا */
  gateway: string;
  /** برای تأیید یک بار تکرار می‌کنیم؛ برای صدور هرگز */
  retries?: number;
  headers?: Record<string, string>;
}

export async function gatewayPost<T>(url: string, opts: GatewayFetchOptions): Promise<T> {
  const attempts = (opts.retries ?? 0) + 1;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...opts.headers },
        body: JSON.stringify(opts.body),
        signal: AbortSignal.timeout(opts.timeoutMs),
        cache: 'no-store',
      });

      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        /* درگاه چیزی برگرداند که JSON نیست. متن خام را در لاگ نگه می‌داریم
           چون برای پیگیری با PSP لازم می‌شود، ولی به کاربر نشان نمی‌دهیم. */
        console.error(
          `[payments] ${opts.gateway} پاسخ غیر JSON داد (HTTP ${res.status}):`,
          text.slice(0, 300),
        );
        throw new AppError(
          'درگاه پرداخت پاسخ نامعتبر داد. اگر مبلغی کسر شده، تا ۷۲ ساعت به‌صورت خودکار بازمی‌گردد.',
          502,
          'GATEWAY_BAD_RESPONSE',
        );
      }
    } catch (error) {
      lastError = error;

      /* خطای خودِ ما (پاسخ نامعتبر) تکرارکردنی نیست */
      if (error instanceof AppError) throw error;

      const isTimeout =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

      if (i === attempts - 1) {
        console.error(`[payments] ${opts.gateway} ناموفق (تلاش ${i + 1}/${attempts}):`, error);
        throw new AppError(
          isTimeout
            ? 'درگاه پرداخت در زمان مقرر پاسخ نداد. اگر مبلغی کسر شده، تا ۷۲ ساعت بازمی‌گردد.'
            : 'ارتباط با درگاه پرداخت برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.',
          504,
          'GATEWAY_UNREACHABLE',
        );
      }

      /* کمی صبر پیش از تلاش دوم — اگر درگاه لحظه‌ای قطع شده باشد */
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  throw lastError;
}
