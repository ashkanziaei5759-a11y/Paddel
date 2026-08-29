'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, CalendarDays, ImagePlay, LandPlot, LayoutDashboard, Newspaper, Settings, ShoppingBag, TrendingUp, Trophy, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
  { href: '/admin', label: 'داشبورد', Icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'کاربران', Icon: Users },
  { href: '/admin/courts', label: 'زمین‌ها', Icon: LandPlot },
  { href: '/admin/bookings', label: 'رزروها', Icon: CalendarDays },
  { href: '/admin/tournaments', label: 'تورنومنت‌ها', Icon: Trophy },
  { href: '/admin/store', label: 'فروشگاه', Icon: ShoppingBag },
  { href: '/admin/banners', label: 'بنرها', Icon: ImagePlay },
  { href: '/admin/news', label: 'اخبار', Icon: Newspaper },
  { href: '/admin/finance', label: 'مالی', Icon: TrendingUp },
  { href: '/admin/settings', label: 'تنظیمات', Icon: Settings },
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
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-gradient">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="#003049" />
              <path d="M5 6.5c3 2 3 9 0 11M19 6.5c-3 2-3 9 0 11" stroke="#FFF" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
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
              <item.Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
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
            <ArrowLeftRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            بازگشت به اپلیکیشن
          </Link>
        </div>
      </aside>

      {/* ---- نوار موبایل ---- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-100/80 bg-card/90 backdrop-blur-xl lg:hidden"
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
              <item.Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              <span className="whitespace-nowrap text-[9px] font-bold">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/home"
            className="flex min-w-[68px] flex-1 flex-col items-center gap-1 py-2.5 text-brand-300"
          >
            <ArrowLeftRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            <span className="whitespace-nowrap text-[9px] font-bold">اپلیکیشن</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
