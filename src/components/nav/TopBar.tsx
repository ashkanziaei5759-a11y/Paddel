import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { toFaDigits } from '@/lib/datetime';
import type { SessionUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

export function TopBar({
  user,
  unread = 0,
  title,
  subtitle,
  back,
  className,
}: {
  user?: SessionUser | null;
  unread?: number;
  title?: string;
  subtitle?: string;
  back?: string;
  className?: string;
}) {
  return (
    <header
      className={cn('sticky top-0 z-40 bg-app/85 backdrop-blur-xl safe-top', className)}
    >
      <div className="app-shell page-pad flex items-center gap-3 py-3">
        {back && (
          <Link
            href={back}
            aria-label="بازگشت"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-brand-500 shadow-card transition hover:text-brand-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {title ? (
            <>
              <h1 className="truncate text-base font-extrabold text-brand-800">{title}</h1>
              {subtitle && <p className="truncate text-[11px] font-semibold text-brand-400">{subtitle}</p>}
            </>
          ) : (
            user && (
              <>
                <p className="text-[11px] font-bold text-brand-400">خوش آمدید 👋</p>
                <h1 className="truncate text-base font-extrabold text-brand-800">{user.fullName}</h1>
              </>
            )
          )}
        </div>

        <ThemeToggle className="shrink-0" />

        <Link
          href="/notifications"
          aria-label="اعلان‌ها"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-brand-500 shadow-card transition hover:text-brand-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="num absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-on-accent shadow-glow">
              {unread > 99 ? '۹۹+' : toFaDigits(unread)}
            </span>
          )}
        </Link>

        {user && !title && (
          <Link href="/profile" aria-label="پروفایل">
            <Avatar firstName={user.firstName} lastName={user.lastName} src={user.avatarUrl} size="md" />
          </Link>
        )}
      </div>
    </header>
  );
}
