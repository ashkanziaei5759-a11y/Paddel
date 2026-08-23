'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function Icon({ path, filled }: { path: string; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[22px] w-[22px]"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  booking: 'M7 3v3M17 3v3M3.5 9.5h17M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  trophy: 'M7 4h10v3a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M10 12h4l-.5 4h-3zM8 20h8v1H8z',
  wallet: 'M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm14 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0z',
};

export function BottomNav({ notificationCount = 0 }: { notificationCount?: number }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: '/home', label: 'خانه', icon: PATHS.home },
    { href: '/booking', label: 'رزرو زمین', icon: PATHS.booking },
    { href: '/tournaments', label: 'تورنومنت‌ها', icon: PATHS.trophy },
    { href: '/wallet', label: 'کیف پول', icon: PATHS.wallet },
    { href: '/profile', label: 'پروفایل', icon: PATHS.profile },
  ].map((i) => ({ ...i, icon: i.icon as unknown as React.ReactNode }));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-100/80 bg-white/85 backdrop-blur-xl"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
      aria-label="ناوبری اصلی"
    >
      <div className="app-shell flex items-stretch justify-around px-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isProfile = item.href === '/profile';
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors duration-200',
                active ? 'text-brand-700' : 'text-brand-300 hover:text-brand-500',
              )}
            >
              <span className="relative">
                <Icon path={item.icon as unknown as string} filled={active} />
                {isProfile && notificationCount > 0 && (
                  <span className="num absolute -top-1.5 -left-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-brand-900">
                    {notificationCount > 9 ? '۹+' : toFaDigits(notificationCount)}
                  </span>
                )}
              </span>
              <span className={cn('text-[10px] font-bold', active && 'text-brand-700')}>
                {item.label}
              </span>
              {active && (
                <span className="absolute -top-px h-1 w-10 rounded-full bg-accent-gradient" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
