import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * قالبِ بارگذاری اخبار باشگاه.
 *
 * نکست تا آماده شدن داده این را نشان می‌دهد. جای محتوای واقعی را می‌گیرد تا
 * وقتی داده رسید چیدمان نپرد.
 */
export default function Loading() {
  return (
    <div className="page-pad space-y-4 pt-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">در حال بارگذاری…</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-44 w-full rounded-3xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
