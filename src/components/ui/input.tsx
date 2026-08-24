import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-2xl border border-brand-100 bg-surface-muted px-4 py-3 text-sm text-brand-800',
        'placeholder:text-brand-300 transition-all duration-200',
        'focus-visible:border-brand-300 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
