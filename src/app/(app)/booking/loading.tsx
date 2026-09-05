import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * قالبِ بارگذاری رزرو زمین.
 *
 * نکست تا آماده شدن داده این را نشان می‌دهد. جای محتوای واقعی را می‌گیرد تا
 * وقتی داده رسید چیدمان نپرد.
 */
export default function Loading() {
  return (
    <div className="page-pad space-y-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری…</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-[68px] w-full rounded-3xl" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 flex-1 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
