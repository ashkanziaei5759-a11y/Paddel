import Link from 'next/link';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon = '🎾',
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-3xl">
        {icon}
      </div>
      <h3 className="text-sm font-extrabold text-brand-800">{title}</h3>
      {description && <p className="max-w-xs text-xs leading-6 text-brand-400">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-accent btn-sm mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
