/**
 * نشانی عمومی اپ (مثلاً https://persianpdl.ir).
 *
 * نکست هر `process.env.NEXT_PUBLIC_*` را هنگام build با مقدارِ همان لحظه
 * جایگزین می‌کند — حتی در کد سرور. یعنی بسته‌ای که روی سیستم دیگری ساخته شود،
 * نشانیِ آن سیستم (مثلاً localhost) را با خود می‌برد و بازگشت از درگاه پرداخت
 * به آن‌جا می‌رود. با خواندنِ کلید از یک متغیر، مقدار در زمان اجرا از `.env`
 * سرور خوانده می‌شود و یک بسته برای هر دامنه‌ای کار می‌کند.
 */
const KEY = 'NEXT_PUBLIC_APP_URL';

export function appUrl(): string | undefined {
  const value = process.env[KEY]?.trim();
  return value ? value.replace(/\/+$/, '') : undefined;
}
