import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ring?: boolean;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export function Avatar({ firstName, lastName, src, size = 'md', className, ring }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-gradient font-black text-white',
        SIZE[size],
        ring && 'ring-2 ring-accent ring-offset-2 ring-offset-white',
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${firstName} ${lastName}`} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(firstName, lastName)}</span>
      )}
    </div>
  );
}
