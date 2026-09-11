/**
 * تماس‌های سمت مرورگر با API.
 *
 * چرا لازم است: `fetch` هیچ مهلت پیش‌فرضی ندارد. روی دیتای موبایل ایران —
 * که قطع و وصل شدن و کندی ناگهانی‌اش عادی است — یک درخواست می‌تواند تا ابد
 * باز بماند. از دید کاربر یعنی دکمه‌ای که برای همیشه چرخ می‌زند و صفحه‌ای
 * که «هنگ کرده». نه خطایی، نه راه برگشتی.
 *
 * پس هر تماس مهلت دارد، قطعیِ شبکه از کندیِ سرور جدا تشخیص داده می‌شود، و
 * پیام‌ها فارسی و قابل‌فهم‌اند.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** آیا تلاش دوباره منطقی است؟ برای نشان‌دادن دکمه‌ی «تلاش مجدد» */
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'signal'> {
  /** مهلت بر حسب میلی‌ثانیه. پیش‌فرض ۱۵ ثانیه. */
  timeoutMs?: number;
  /** برای لغو دستی، مثلاً وقتی کامپوننت unmount می‌شود */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT = 15_000;

/**
 * پرداخت و رزرو مهلت بلندتری می‌گیرند: پشت صحنه قفل ردیف و تراکنش دارند و
 * نصفه‌کاره رهاکردنشان بدتر از صبرکردن است.
 */
export const API_TIMEOUT = {
  normal: 15_000,
  money: 30_000,
} as const;

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal: external, ...init } = options;

  /* مرورگر همین حالا می‌داند شبکه قطع است — بی‌جهت منتظر مهلت نمانیم */
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('اتصال اینترنت شما قطع است.', 0, 'OFFLINE', true);
  }

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = external ? AbortSignal.any([external, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal,
      headers:
        init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json', ...init.headers }
          : init.headers,
    });
  } catch (error) {
    /* لغو دستی خطا نیست — همان‌طور بالا برود تا فراخواننده نادیده‌اش بگیرد */
    if (external?.aborted) throw error;

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ApiError(
        'سرور در زمان مقرر پاسخ نداد. لطفاً دوباره تلاش کنید.',
        0,
        'TIMEOUT',
        true,
      );
    }
    throw new ApiError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.', 0, 'NETWORK', true);
  }

  let json: { ok?: boolean; data?: T; error?: string; code?: string } = {};
  try {
    json = await res.json();
  } catch {
    /* پاسخ JSON نبود — معمولاً صفحه‌ی خطای پروکسی یا ۵۰۲ */
    throw new ApiError(
      res.ok ? 'پاسخ سرور قابل خواندن نبود.' : 'خطای سرور. لطفاً بعداً تلاش کنید.',
      res.status,
      'BAD_RESPONSE',
      true,
    );
  }

  if (!res.ok || !json.ok) {
    throw new ApiError(
      json.error || 'درخواست انجام نشد.',
      res.status,
      json.code,
      /* ۵xx و ۴۲۹ ارزش تلاش دوباره دارند؛ ۴xx دیگر یعنی خودِ درخواست ایراد دارد */
      res.status >= 500 || res.status === 429,
    );
  }

  return json.data as T;
}

/** پیام خطای هر چیزی که از apiFetch بیرون می‌آید */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === 'AbortError') return '';
  return 'خطای غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.';
}
