import { cn } from '@/lib/utils';

/**
 * قالب خاکستریِ محتوا، هنگام بارگذاری.
 *
 * جای واقعی محتوا را از همان اول می‌گیرد تا وقتی داده رسید، چیدمان صفحه
 * نپرد (همان چیزی که در سنجه‌های وب با نام CLS اندازه گرفته می‌شود).
 * برای صفحه‌خوان‌ها پنهان است — خبرِ «در حال بارگذاری» را والدِ صفحه با
 * aria-busy می‌دهد، نه تک‌تک این قالب‌ها.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl bg-surface-muted', className)}
    />
  );
}

/** چند خط متنِ ساختگی — برای فهرست‌ها و کارت‌های متنی */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-1/2' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** اسکلت یک کارت کامل — تصویر/آیکون در کنار دو خط متن */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card flex items-center gap-3 p-4', className)}>
      <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
  );
}
