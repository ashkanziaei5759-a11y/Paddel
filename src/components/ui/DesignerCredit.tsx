import { cn } from '@/lib/utils';

/**
 * امضای طراح در انتهای صفحه‌ها.
 *
 * متن انگلیسی است، بنابراین با dir="ltr" از الگوریتم دوسویه‌ی یونیکد جدا
 * می‌شود تا در صفحه‌ی راست‌به‌چپ به‌هم نریزد. لینک بیرونی است و با
 * rel="noopener noreferrer" باز می‌شود تا صفحه‌ی مقصد به window.opener
 * دسترسی نداشته باشد.
 */
export function DesignerCredit({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'glass' }) {
  return (
    <p dir="ltr" className={cn('text-center text-[11px] font-semibold', className)}>
      <a
        href="https://ashkanz.netlify.app/"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 tracking-wide transition-colors',
          tone === 'glass'
            ? 'text-white/55 hover:bg-white/10 hover:text-white'
            : 'text-brand-300 hover:bg-brand-50 hover:text-brand-600',
        )}
      >
        Designed By <span className="font-black">Ashkan Ziaei</span>
      </a>
    </p>
  );
}
