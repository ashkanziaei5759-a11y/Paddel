import { OfflineRetry } from './OfflineRetry';

export const metadata = { title: 'آفلاین' };

/**
 * صفحه‌ای که service worker وقتی شبکه نیست نشان می‌دهد.
 *
 * آیکون به‌جای ایموجی یک SVG است: ایموجی روی هر سیستم‌عامل شکل دیگری دارد و
 * در اندازه‌ی بزرگ بی‌ریخت می‌شود. دکمه‌ی تلاش دوباره هم لازم است — بدون آن
 * تنها راهِ کاربر، بستن و باز کردن اپ است.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-brand-gradient-soft p-6 text-center">
      <span
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/10 text-white ring-1 ring-white/15"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9"
        >
          <path d="M2 2 22 22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 13a10 10 0 0 1 5.24-2.76" />
          <path d="M12 20h.01" />
        </svg>
      </span>

      <div>
        <h1 className="text-xl font-black text-white">اتصال اینترنت برقرار نیست</h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] font-semibold leading-7 text-sky-light/75">
          این صفحه به اینترنت نیاز دارد. اتصال خود را بررسی کنید و دوباره تلاش کنید —
          صفحه‌هایی که قبلاً باز کرده‌اید همچنان در دسترس‌اند.
        </p>
      </div>

      <OfflineRetry />
    </div>
  );
}
