/**
 * زمان‌بندِ داخلی: هر دقیقه اعلان‌های خودکار (یادآوری یک ساعت پیش از بازی و
 * قانون‌های پنل) را اجرا می‌کند — بدون نیاز به Task Scheduler ویندوز یا cron.
 *
 * مسیر /api/cron/reminders را روی خودِ سرور صدا می‌زند تا کد اعلان‌ها فقط در
 * یک جا اجرا شود. با چند نسخه‌ی هم‌زمان (cluster) هر دقیقه فقط یکی واقعاً
 * اجرا می‌کند و جدول ارسال‌ها جلوی پیام تکراری را می‌گیرد.
 *
 * با DISABLE_SCHEDULER=1 خاموش می‌شود. روی Vercel اجرا نمی‌شود؛ آنجا Vercel
 * Cron همین مسیر را صدا می‌زند.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DISABLE_SCHEDULER === '1' || process.env.VERCEL) return;

  /* همان توکنِ schedulerToken در src/lib/notification-rules.ts — با Web Crypto
     چون این فایل برای محیط edge هم کامپایل می‌شود */
  let token = process.env.CRON_SECRET?.trim() || null;
  if (!token && process.env.AUTH_SECRET) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`scheduler:${process.env.AUTH_SECRET}`),
    );
    token = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  if (!token) return;

  const port = process.env.PORT || '3000';
  const url = `http://127.0.0.1:${port}/api/cron/reminders`;

  const tick = async () => {
    try {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(50_000),
      });
      if (!res.ok) console.warn('[scheduler] reminders returned', res.status);
    } catch {
      /* سرور هنوز بالا نیامده یا لحظه‌ای مشغول است — دقیقه‌ی بعد */
    }
  };

  /* فاصله‌ی تصادفی تا نسخه‌های cluster هم‌زمان شروع نکنند */
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), 60_000).unref();
  }, 20_000 + Math.floor(Math.random() * 10_000)).unref();
}
