import { cn } from '@/lib/utils';

/**
 * امضای طراح در انتهای صفحه‌ی اصلی.
 *
 * متن انگلیسی است، بنابراین با dir="ltr" از الگوریتم دوسویه‌ی یونیکد جدا
 * می‌شود تا در صفحه‌ی راست‌به‌چپ به‌هم نریزد. لینک بیرونی است و با
 * rel="noopener noreferrer" باز می‌شود تا صفحه‌ی مقصد به window.opener
 * دسترسی نداشته باشد.
 */
export function DesignerCredit({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center', className)}>
      <a
        href="https://ashkanz.netlify.app/"
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        /* کارت سفیدِ باریک و کمی برجسته، تا از پس‌زمینه‌ی صفحه جدا بماند */
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-100/80 bg-card px-4 py-2
                   text-[11px] font-semibold tracking-wide text-brand-400 shadow-card transition
                   hover:-translate-y-0.5 hover:text-brand-700 hover:shadow-card-hover"
      >
        Designed By <span className="font-black text-brand-700">Ashkan Ziaei</span>
      </a>
    </div>
  );
}
