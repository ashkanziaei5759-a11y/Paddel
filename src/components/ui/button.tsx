import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** دکمه‌ی پایه — هماهنگ با پالت برند پرشین پدل */
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-bold transition-all duration-200 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent/70 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-700 text-white shadow-card hover:bg-brand-600 hover:shadow-card-hover',
        accent: 'bg-accent-gradient text-brand-900 shadow-card hover:shadow-glow',
        destructive: 'bg-danger/10 text-danger hover:bg-danger/15',
        outline: 'border border-brand-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50',
        secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        ghost: 'text-brand-600 hover:bg-brand-50',
        link: 'text-brand-700 underline-offset-4 hover:underline',
        glass: 'border border-white/20 bg-white/10 text-white backdrop-blur-xl hover:bg-white/20',
      },
      size: {
        default: 'h-11 px-5 py-3',
        sm: 'h-9 rounded-xl px-3.5 text-xs',
        lg: 'h-13 rounded-2xl px-7 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
