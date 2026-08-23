'use client';

import { cn } from '@/lib/utils';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 rounded-2xl bg-brand-50 p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200',
            value === opt.value
              ? 'bg-white text-brand-800 shadow-card'
              : 'text-brand-400 hover:text-brand-600',
          )}
        >
          {opt.label}
          {opt.count !== undefined && opt.count > 0 && (
            <span className="num mr-1 text-[10px] opacity-70">({opt.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
