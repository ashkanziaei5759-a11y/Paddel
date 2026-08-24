'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin', label: 'داشبورد', icon: '📊', exact: true },
  { href: '/admin/users', label: 'کاربران', icon: '👥' },
  { href: '/admin/courts', label: 'زمین‌ها', icon: '🏟' },
  { href: '/admin/bookings', label: 'رزروها', icon: '📅' },
  { href: '/admin/tournaments', label: 'تورنومنت‌ها', icon: '🏆' },
  { href: '/admin/finance', label: 'مالی', icon: '💰' },
  { href: '/admin/settings', label: 'تنظیمات', icon: '⚙️' },
];

export function AdminNav({ fullName, username }: { fullName: string; username: string }) {
  const pathname = usePathname();
  const isActive = (item: (typeof ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      {/* ---- کناره‌ی دسکتاپ ---- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-brand-gradient p-5 lg:flex">
        <div className="relative mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-gradient text-xl">
            👑
          </span>
          <div>
            <p className="text-sm font-black text-white">پنل مدیریت</p>
            <p className="text-[10px] font-bold tracking-widest text-sky-light/60">PERSIAN PADEL</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition-all duration-200',
                isActive(item)
                  ? 'bg-white/15 text-white shadow-inset'
                  : 'text-sky-light/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
          <div className="px-2">
            <p className="truncate text-xs font-extrabold text-white">{fullName}</p>
            <p className="num truncate text-[10px] font-bold text-sky-light/60" dir="ltr">
              @{username}
            </p>
          </div>
          <Link
            href="/home"
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-sky-light/70 transition hover:bg-white/10 hover:text-white"
          >
            ↩ بازگشت به اپلیکیشن
          </Link>
        </div>
      </aside>

      {/* ---- نوار موبایل ---- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-100/80 bg-white/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="no-scrollbar flex items-stretch overflow-x-auto px-1">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-[68px] flex-1 flex-col items-center gap-1 py-2.5 transition-colors',
                isActive(item) ? 'text-brand-700' : 'text-brand-300',
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span className="whitespace-nowrap text-[9px] font-bold">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/home"
            className="flex min-w-[68px] flex-1 flex-col items-center gap-1 py-2.5 text-brand-300"
          >
            <span className="text-base">↩</span>
            <span className="whitespace-nowrap text-[9px] font-bold">اپلیکیشن</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
