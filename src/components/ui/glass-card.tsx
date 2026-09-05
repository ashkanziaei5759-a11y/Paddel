import { cn } from '@/lib/utils';

/**
 * کارت شیشه‌ای — برای نشستن روی تصویر.
 *
 * پس‌زمینه‌ی نیمه‌شفاف با تاری، به‌علاوه‌ی یک خط نور در لبه‌ی بالا که حس شیشه
 * را می‌سازد. رنگ‌ها ثابت‌اند و با تم عوض نمی‌شوند، چون این کارت همیشه روی
 * تصویر تیره می‌نشیند.
 */
function GlassCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'relative flex flex-col gap-6 rounded-[28px] border border-white/15 py-6 text-white',
        /* پس‌زمینه و تاری از glass-surface می‌آید: شیشه‌ی شفاف هرجا مرورگر
           backdrop-filter دارد، و سرمه‌ای مات هرجا ندارد */
        'glass-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,.85)]',
        /* بازتاب نور روی لبه‌ی بالایی */
        'before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px',
        'before:bg-gradient-to-l before:from-transparent before:via-white/50 before:to-transparent',
        className,
      )}
      {...props}
    />
  );
}

function GlassCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn(
        'grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6',
        'has-[[data-slot=glass-card-action]]:grid-cols-[1fr_auto]',
        className,
      )}
      {...props}
    />
  );
}

function GlassCardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-title"
      className={cn('text-2xl font-black leading-tight tracking-tight', className)}
      {...props}
    />
  );
}

function GlassCardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-description"
      className={cn('text-[12.5px] font-semibold leading-7 text-white/65', className)}
      {...props}
    />
  );
}

function GlassCardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function GlassCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="glass-card-content" className={cn('px-6', className)} {...props} />;
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center px-6', className)}
      {...props}
    />
  );
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardAction,
  GlassCardContent,
  GlassCardFooter,
};
