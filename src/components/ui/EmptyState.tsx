import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon = 'court',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  /** یکی از این دو: پیوند به صفحه‌ی دیگر، یا عملی در همین صفحه (مثل تعویض تب) */
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-400">
        <Icon name={icon} className="h-7 w-7" strokeWidth={1.7} />
      </div>
      <h3 className="text-sm font-extrabold text-brand-800">{title}</h3>
      {description && <p className="max-w-xs text-xs leading-6 text-brand-400">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-accent btn-sm mt-2">
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <button type="button" onClick={onAction} className="btn-accent btn-sm mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
