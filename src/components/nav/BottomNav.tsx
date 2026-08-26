'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home, Medal, Trophy, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

/**
 * پنج مقصد اصلی. راهنمای ناوبری موبایل بیش از پنج آیتم را توصیه نمی‌کند، پس
 * فقط کارهای پرتکرار اینجا می‌مانند: کیف پول و فروشگاه به کارت صفحه‌ی اصلی و
 * منوی پروفایل منتقل شده‌اند.
 *
 * فقط مقصد فعال برچسب دارد. روی عرض ۳۲۰ پیکسل، پنج برچسب فارسی کنار هم یا
 * بریده می‌شوند یا آن‌قدر ریز می‌شوند که خوانا نباشند؛ این‌طور مقصد فعلی در یک
 * نگاه معلوم است و بقیه فضای لمس کامل خود را نگه می‌دارند.
 */
const ITEMS = [
  { href: '/home', label: 'خانه', Icon: Home },
  { href: '/booking', label: 'رزرو', Icon: CalendarDays },
  { href: '/matches', label: 'بازی‌ها', Icon: Users },
  { href: '/ranking', label: 'رنکینگ', Icon: Medal },
  { href: '/tournaments', label: 'تورنومنت', Icon: Trophy },
  { href: '/profile', label: 'پروفایل', Icon: User },
];

export function BottomNav({ notificationCount = 0 }: { notificationCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 pb-[var(--safe-bottom)]"
      aria-label="ناوبری اصلی"
    >
      {/* محو شدن تدریجی محتوا پشت نوار */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-app via-app/85 to-transparent" />

      <div className="app-shell relative px-3 pb-2">
        <div className="flex items-center justify-between gap-1 rounded-[26px] border border-brand-100/70 bg-surface-muted/95 p-1.5 shadow-premium backdrop-blur-2xl">
          {ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isProfile = item.href === '/profile';

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-12 min-w-12 items-center justify-center gap-2 rounded-[20px] px-3 transition-all duration-300',
                  active
                    ? 'flex-1 bg-electric-gradient text-white shadow-lift-electric'
                    : 'text-brand-400 active:scale-95',
                )}
              >
                <item.Icon
                  className="h-[21px] w-[21px] shrink-0"
                  strokeWidth={active ? 2.3 : 1.9}
                />
                {active && (
                  <span className="truncate text-[11.5px] font-extrabold">{item.label}</span>
                )}

                {isProfile && notificationCount > 0 && !active && (
                  <span className="num absolute -top-0.5 left-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-on-accent">
                    {notificationCount > 9 ? '۹+' : toFaDigits(notificationCount)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
