import type { PlayerLevel } from '@prisma/client';
import { LEVEL_LABEL, levelTier } from '@/lib/constants';
import { cn } from '@/lib/utils';

const TIER_STYLE: Record<string, string> = {
  A: 'bg-accent-gradient text-brand-900 shadow-glow',
  B: 'bg-brand-700 text-white',
  C: 'bg-brand-100 text-brand-700',
  D: 'bg-brand-50 text-brand-500',
};

export function LevelBadge({
  level,
  size = 'md',
  withLabel = false,
  className,
}: {
  level: PlayerLevel;
  size?: 'sm' | 'md' | 'lg';
  withLabel?: boolean;
  className?: string;
}) {
  const tier = levelTier(level);
  const sizeCls =
    size === 'lg'
      ? 'h-11 min-w-11 px-3 text-base'
      : size === 'sm'
        ? 'h-6 min-w-6 px-2 text-[10px]'
        : 'h-8 min-w-8 px-2.5 text-xs';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-black tracking-tight',
          TIER_STYLE[tier],
          sizeCls,
        )}
      >
        {LEVEL_LABEL[level]}
      </span>
      {withLabel && <span className="text-xs font-bold text-brand-400">سطح</span>}
    </span>
  );
}
