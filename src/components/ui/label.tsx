'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'mb-2 block text-xs font-bold leading-none text-brand-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      /* روی کارت شیشه‌ای (صفحه‌ی ورود) پس‌زمینه تیره است و سرمه‌ای خوانا نیست */
      '[.on-glass_&]:text-white/75',
      className,
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
