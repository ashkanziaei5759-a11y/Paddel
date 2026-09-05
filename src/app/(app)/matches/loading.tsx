import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * قالبِ بارگذاری بازی‌های باز.
 *
 * نکست تا آماده شدن داده این را نشان می‌دهد. جای محتوای واقعی را می‌گیرد تا
 * وقتی داده رسید چیدمان نپرد.
 */
export default function Loading() {
  return (
    <div className="page-pad space-y-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری…</span>
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[168px] w-full rounded-3xl" />
      ))}
    </div>
  );
}
