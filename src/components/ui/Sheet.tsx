'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

/** پنل کشویی از پایین صفحه — الگوی بومی موبایل */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-scrim/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 max-h-[88vh] w-full max-w-[520px] animate-slide-up overflow-y-auto rounded-t-4xl bg-card p-5 shadow-premium sm:animate-scale-in sm:rounded-4xl',
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-100 sm:hidden" />
        {title && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-brand-800">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-400 transition hover:bg-brand-100"
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
