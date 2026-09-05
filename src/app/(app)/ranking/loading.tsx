import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * قالبِ بارگذاری رنکینگ.
 *
 * نکست تا آماده شدن داده این را نشان می‌دهد. جای محتوای واقعی را می‌گیرد تا
 * وقتی داده رسید چیدمان نپرد.
 */
export default function Loading() {
  return (
    <div className="page-pad space-y-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری…</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-16 rounded-2xl" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden pt-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] w-[268px] shrink-0 rounded-3xl" />
        ))}
      </div>
      <div className="card divide-y divide-brand-50 p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
