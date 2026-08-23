import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { formatDateTime, formatJalaliDate, formatRelative, formatTime, toFaDigits } from '@/lib/datetime';
import { formatNumber, formatToman } from '@/lib/utils';
import { TOURNAMENT_STATUS_LABEL } from '@/lib/constants';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'خانه' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requirePage();
  const now = new Date();

  const [wallet, unread, nextBooking, bookingCount, upcomingTournaments, pendingRequests] =
    await Promise.all([
      prisma.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
      unreadCount(user.id),
      prisma.booking.findFirst({
        where: { userId: user.id, status: 'CONFIRMED', startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        include: { court: { select: { name: true } } },
      }),
      prisma.booking.count({ where: { userId: user.id, status: { in: ['CONFIRMED', 'COMPLETED'] } } }),
      prisma.tournament.findMany({
        where: { status: { in: ['REGISTRATION_OPEN', 'ONGOING'] } },
        orderBy: { startsAt: 'asc' },
        take: 3,
        include: { _count: { select: { teams: true } } },
      }),
      prisma.partnerRequest.count({ where: { receiverId: user.id, status: 'PENDING' } }),
    ]);

  const balance = wallet?.balance ?? 0n;

  return (
    <>
      <TopBar user={user} unread={unread} />

      <div className="page-pad stagger space-y-5 pt-1">
        {/* ---- کارت وضعیت بازیکن ---- */}
        <section className="card-dark p-5">
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-sky-light/60">وضعیت شما</p>
              <div className="mt-2 flex items-center gap-2">
                <LevelBadge level={user.level} size="lg" />
                <div>
                  <p className="text-[11px] font-bold text-sky-light/60">سطح بازیکن</p>
                  <p className="text-xs font-black text-white">
                    {user.role === 'ADMIN' ? 'مدیر باشگاه' : 'بازیکن باشگاه'}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-left">
              <p className="text-[11px] font-bold tracking-widest text-sky-light/60">امتیاز</p>
              <p className="num mt-1 text-3xl font-black text-accent">
                {formatNumber(user.points)}
              </p>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold text-sky-light/60">موجودی کیف پول</p>
              <p className="num mt-1 text-sm font-black text-white">{formatToman(balance)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold text-sky-light/60">تعداد رزروها</p>
              <p className="num mt-1 text-sm font-black text-white">{formatNumber(bookingCount)}</p>
            </div>
          </div>

          <div className="relative mt-4 flex gap-2">
            <Link href="/booking" className="btn-accent btn-sm flex-1">
              رزرو زمین
            </Link>
            <Link
              href="/wallet"
              className="btn btn-sm flex-1 border border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              شارژ کیف پول
            </Link>
          </div>
        </section>

        {/* ---- درخواست پارتنر در انتظار ---- */}
        {pendingRequests > 0 && (
          <Link href="/partner-requests" className="card-interactive block bg-accent-50 p-4 ring-accent-100">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-gradient text-xl">
                🤝
              </span>
              <div className="flex-1">
                <p className="text-xs font-extrabold text-accent-700">
                  {toFaDigits(pendingRequests)} درخواست پارتنری در انتظار پاسخ شماست
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-accent-600">
                  برای مشاهده و پاسخ کلیک کنید
                </p>
              </div>
              <span className="text-accent-600">‹</span>
            </div>
          </Link>
        )}

        {/* ---- رزرو بعدی ---- */}
        <section>
          <div className="section-title mb-3">
            <h2>رزرو بعدی شما</h2>
            <Link href="/bookings" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
              همه رزروها
            </Link>
          </div>

          {nextBooking ? (
            <Link href={`/bookings/${nextBooking.id}`} className="card-interactive block p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-gradient text-white">
                  <span className="num text-lg font-black leading-none">
                    {formatTime(nextBooking.startsAt)}
                  </span>
                  <span className="mt-1 text-[9px] font-bold text-sky-light/70">
                    {formatJalaliDate(nextBooking.startsAt, { short: true })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-brand-800">
                    {nextBooking.court.name}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-brand-400">
                    {formatJalaliDate(nextBooking.startsAt, { withWeekday: true })}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="badge-accent">{formatRelative(nextBooking.startsAt)}</span>
                    <span className="badge-muted num">{nextBooking.code}</span>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState
              icon="📅"
              title="رزرو فعالی ندارید"
              description="زمین موردنظر خود را انتخاب کنید و بازی بعدی‌تان را رزرو کنید."
              actionLabel="رزرو زمین"
              actionHref="/booking"
            />
          )}
        </section>

        {/* ---- تورنومنت‌های پیش‌رو ---- */}
        <section>
          <div className="section-title mb-3">
            <h2>تورنومنت‌های پیش‌رو 🏆</h2>
            <Link href="/tournaments" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
              همه
            </Link>
          </div>

          {upcomingTournaments.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="تورنومنت فعالی وجود ندارد"
              description="به‌زودی تورنومنت‌های جدید اعلام می‌شوند."
            />
          ) : (
            <div className="space-y-3">
              {upcomingTournaments.map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`} className="card-interactive block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-brand-800">{t.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-brand-400">
                        {formatDateTime(t.startsAt)}
                      </p>
                    </div>
                    <span
                      className={
                        t.status === 'REGISTRATION_OPEN' ? 'badge-accent shrink-0' : 'badge-brand shrink-0'
                      }
                    >
                      {TOURNAMENT_STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-brand-400">
                    <span className="num">
                      {toFaDigits(t._count.teams)} / {toFaDigits(t.maxTeams)} تیم
                    </span>
                    {t.entryFee > 0n && (
                      <>
                        <Dot className="text-brand-200" />
                        <span className="num">ورودی {formatToman(t.entryFee)}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                    <div
                      className="h-full rounded-full bg-accent-gradient transition-all"
                      style={{ width: `${Math.min(100, (t._count.teams / t.maxTeams) * 100)}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---- دسترسی سریع ---- */}
        <section>
          <h2 className="mb-3 text-base font-extrabold text-brand-800">دسترسی سریع</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/booking" icon="🎾" title="رزرو زمین" subtitle="انتخاب تاریخ و ساعت" />
            <QuickAction href="/tournaments" icon="🏆" title="تورنومنت‌ها" subtitle="ثبت‌نام و نتایج" />
            <QuickAction href="/wallet" icon="💳" title="کیف پول" subtitle="شارژ و تراکنش‌ها" />
            <QuickAction href="/bookings" icon="📋" title="تاریخچه" subtitle="رزروهای گذشته" />
            {user.role === 'ADMIN' && (
              <QuickAction
                href="/admin"
                icon="👑"
                title="پنل مدیریت"
                subtitle="مدیریت باشگاه"
                className="col-span-2 bg-brand-gradient text-white"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function QuickAction({
  href,
  icon,
  title,
  subtitle,
  className,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  className?: string;
}) {
  const isDark = className?.includes('bg-brand-gradient');
  return (
    <Link href={href} className={`card-interactive flex items-center gap-3 p-4 ${className ?? ''}`}>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${
          isDark ? 'bg-white/15' : 'bg-brand-50'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-xs font-extrabold ${isDark ? 'text-white' : 'text-brand-800'}`}>
          {title}
        </span>
        <span className={`block truncate text-[10px] font-semibold ${isDark ? 'text-sky-light/70' : 'text-brand-400'}`}>
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
