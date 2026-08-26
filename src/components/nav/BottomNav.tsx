'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home, Trophy, User, Users } from 'lucide-react';
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock';
import { cn } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

/**
 * پنج مقصد اصلی. راهنمای ناوبری موبایل بیش از پنج آیتم را توصیه نمی‌کند، پس
 * فقط کارهای پرتکرار اینجا می‌مانند: کیف پول و فروشگاه از نوار پایین به کارت
 * صفحه‌ی اصلی و منوی پروفایل منتقل شده‌اند تا جای «بازی‌ها» باز شود.
 */
const ITEMS = [
  { href: '/home', label: 'خانه', Icon: Home },
  { href: '/booking', label: 'رزرو زمین', Icon: CalendarDays },
  { href: '/matches', label: 'بازی‌ها', Icon: Users },
  { href: '/tournaments', label: 'تورنومنت‌ها', Icon: Trophy },
  { href: '/profile', label: 'پروفایل', Icon: User },
];

export function BottomNav({ notificationCount = 0 }: { notificationCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 pb-[var(--safe-bottom)]"
      aria-label="ناوبری اصلی"
    >
      {/* محو شدن تدریجی محتوا پشت داک */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-muted via-surface-muted/85 to-transparent" />

      <div className="app-shell relative px-3 pb-2">
        <Dock
          className="border border-white/60 bg-white/85 shadow-premium backdrop-blur-2xl"
          panelHeight={62}
        >
          {ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isProfile = item.href === '/profile';

            return (
              <DockItem key={item.href} active={active} className="rounded-2xl">
                {/* راهنمای شناور فقط برای دسکتاپ معنا دارد */}
                <DockLabel>{item.label}</DockLabel>

                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex h-full w-full flex-col items-center justify-center gap-0.5"
                >
                  <span className="relative flex items-center justify-center">
                    <item.Icon
                      className={cn(
                        'h-[22px] w-[22px] transition-colors duration-200',
                        active ? 'text-brand-700' : 'text-brand-300',
                      )}
                      strokeWidth={active ? 2.4 : 1.9}
                      aria-hidden="true"
                    />
                    {isProfile && notificationCount > 0 && (
                      <span className="num absolute -top-1.5 -left-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-brand-900">
                        {notificationCount > 9 ? '۹+' : toFaDigits(notificationCount)}
                      </span>
                    )}
                  </span>

                  {/*
                    روی دستگاه‌های لمسی راهنمای شناور هرگز ظاهر نمی‌شود،
                    بنابراین برچسب همیشه زیر آیکون نوشته می‌شود. روی دسکتاپ
                    که بزرگ‌نمایی و tooltip کار می‌کند، برچسب پنهان می‌ماند.
                  */}
                  <span
                    className={cn(
                      'text-[9px] font-bold leading-none transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:hidden',
                      active ? 'text-brand-700' : 'text-brand-300',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>

                {/* نشانگر صفحه‌ی فعال — روی لمس تنها راهنمای وضعیت است */}
                <span
                  className={cn(
                    'pointer-events-none absolute inset-x-3 -bottom-0.5 h-1 rounded-full transition-all duration-300',
                    active ? 'bg-accent-gradient opacity-100' : 'opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'pointer-events-none absolute inset-0 -z-10 rounded-2xl transition-colors duration-300',
                    active ? 'bg-brand-50' : 'bg-transparent',
                  )}
                />
              </DockItem>
            );
          })}
        </Dock>
      </div>
    </nav>
  );
}
