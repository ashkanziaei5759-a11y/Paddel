import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'light',
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'light' | 'dark' | 'accent';
  className?: string;
}) {
  const toneCls =
    tone === 'dark'
      ? 'bg-brand-gradient text-white ring-0'
      : tone === 'accent'
        ? 'bg-accent-50 text-accent-700 ring-accent-100'
        : 'bg-white text-brand-800 ring-brand-900/[.04]';

  return (
    <div className={cn('relative overflow-hidden rounded-3xl p-4 shadow-card ring-1', toneCls, className)}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-[11px] font-bold',
            tone === 'dark' ? 'text-sky-light/70' : tone === 'accent' ? 'text-accent-600' : 'text-brand-400',
          )}
        >
          {label}
        </p>
        {icon && <span className="text-lg leading-none opacity-80">{icon}</span>}
      </div>
      <p className="num mt-2 text-lg font-black tracking-tight">{value}</p>
      {hint && (
        <p
          className={cn(
            'mt-1 text-[10px] font-semibold',
            tone === 'dark' ? 'text-sky-light/60' : 'text-brand-300',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
