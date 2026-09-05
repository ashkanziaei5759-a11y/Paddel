import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * قالبِ بارگذاری فروشگاه.
 *
 * نکست تا آماده شدن داده این را نشان می‌دهد. جای محتوای واقعی را می‌گیرد تا
 * وقتی داده رسید چیدمان نپرد.
 */
export default function Loading() {
  return (
    <div className="page-pad space-y-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری…</span>
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden p-0">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
