'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/** کلید نگهداری انتخاب کاربر — همان کلیدی که ThemeScript می‌خواند */
const KEY = 'pp-theme';

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    setReady(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* حالت ناشناس مرورگر — انتخاب فقط تا پایان همین بازدید می‌ماند */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'تم روشن' : 'تم تیره'}
      aria-pressed={dark}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-brand-500 shadow-card transition-colors hover:text-brand-700',
        className,
      )}
    >
      {/* تا پیش از خواندن تم، آیکون رندر نمی‌شود تا پرش دیده نشود */}
      {ready && (dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />)}
    </button>
  );
}
