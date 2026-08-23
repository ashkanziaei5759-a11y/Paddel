/**
 * جداکننده‌ی امن برای متن‌های راست‌به‌چپ.
 *
 * نقطه‌ی وسط «·» در الگوریتم دوجهته‌ی یونیکد از نوع Common Separator است؛
 * بنابراین اگر بین دو عدد فارسی قرار بگیرد، هر دو عدد به‌صورت یک عدد واحد
 * بازچینش می‌شوند (مثلاً «زمین ۱ · ۴ شهریور» به شکل «زمین ۴۰۱ شهریور» دیده می‌شود).
 * قرار دادن جداکننده درون یک عنصر ایزوله این اتصال را می‌شکند.
 */
export function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ unicodeBidi: 'isolate' }}
      className={className ?? 'mx-1 opacity-60'}
    >
      ·
    </span>
  );
}
