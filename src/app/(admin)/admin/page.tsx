import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StatCard } from '@/components/ui/StatCard';
import { startOfLocalDay, addDays, formatDateTime, formatTime, toFaDigits } from '@/lib/datetime';
import { formatNumber, formatToman, rialToToman } from '@/lib/utils';
import { getClubMetrics, percentChange } from '@/lib/metrics';
import { BarSeries, KpiTile } from '@/components/admin/charts/Charts';
import { TOURNAMENT_STATUS_LABEL, BOOKING_STATUS_LABEL } from '@/lib/constants';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'داشبورد مدیریت' };
export const dynamic = 'force-dynamic';

const DAYS = 14;
const WEEKDAY = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

export default async function AdminDashboard() {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = addDays(todayStart, 1);

  const [
    userCount,
    activeUserCount,
    todayBookings,
    upcomingBookings,
    todayRevenue,
    totalRevenue,
    activeTournaments,
    courtCount,
    walletTotal,
    recentBookings,
    pendingRequests,
    metrics,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.booking.count({
      where: { startsAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.booking.count({ where: { startsAt: { gte: now }, status: 'CONFIRMED' } }),
    prisma.booking.aggregate({
      where: { createdAt: { gte: todayStart, lt: todayEnd }, status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
    }),
    prisma.booking.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
    }),
    prisma.tournament.count({ where: { status: { in: ['REGISTRATION_OPEN', 'ONGOING'] } } }),
    prisma.court.count({ where: { isActive: true } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        court: { select: { name: true } },
        user: { include: { profile: true } },
      },
    }),
    prisma.partnerRequest.count({ where: { status: 'PENDING' } }),
    getClubMetrics(DAYS),
  ]);

  const labels = metrics.days.map((d) => WEEKDAY[d.day.getDay()] ?? '');
  const revenueToman = metrics.days.map((d) => Number(rialToToman(d.revenue)));
  const bookingCounts = metrics.days.map((d) => d.bookings);
  const newUsers = metrics.days.map((d) => d.newUsers);

  return (
    <>
      <AdminHeader title="داشبورد مدیریت" subtitle="نمای کلی باشگاه پرشین پدل" />

      <div className="stagger space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {/* ---- روند دو هفته: عدد و شکلِ تغییر کنار هم ---- */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label={`درآمد ${toFaDigits(DAYS)} روز`}
            value={formatToman(metrics.current.revenue)}
            delta={percentChange(metrics.current.revenue, metrics.previous.revenue)}
            spark={revenueToman}
            tone="accent"
          />
          <KpiTile
            label={`رزرو ${toFaDigits(DAYS)} روز`}
            value={formatNumber(metrics.current.bookings)}
            delta={percentChange(metrics.current.bookings, metrics.previous.bookings)}
            spark={bookingCounts}
          />
          <KpiTile
            label="کاربران تازه"
            value={formatNumber(metrics.current.newUsers)}
            delta={percentChange(metrics.current.newUsers, metrics.previous.newUsers)}
            spark={newUsers}
            tone="success"
          />
          <KpiTile
            label="موجودی کیف پول‌ها"
            value={formatToman(metrics.totals.walletBalance)}
            hint="تعهد باشگاه به کاربران"
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <BarSeries
            title="درآمد روزانه"
            subtitle={`${toFaDigits(DAYS)} روز گذشته`}
            points={metrics.days.map((d, i) => ({ label: labels[i], value: revenueToman[i] }))}
            format={(v) => formatToman(BigInt(Math.round(v)) * 10n)}
            accent="accent"
          />
          <BarSeries
            title="تعداد رزرو روزانه"
            subtitle="رزروهای ثبت‌شده در هر روز"
            points={metrics.days.map((d, i) => ({ label: labels[i], value: bookingCounts[i] }))}
            format={(v) => formatNumber(v)}
          />
        </div>

        {/* ---- آمار کلیدی ---- */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="کل کاربران"
            value={formatNumber(userCount)}
            hint={`${toFaDigits(activeUserCount)} فعال`}
            icon={<Icon name="users" className="h-4 w-4" />}
            tone="dark"
          />
          <StatCard label="رزروهای امروز" value={formatNumber(todayBookings)} icon={<Icon name="booking" className="h-4 w-4" />} />
          <StatCard label="رزروهای پیش‌رو" value={formatNumber(upcomingBookings)} icon={<Icon name="ticket" className="h-4 w-4" />} />
          <StatCard
            label="تورنومنت فعال"
            value={formatNumber(activeTournaments)}
            icon={<Icon name="tournament" className="h-4 w-4" />}
            tone="accent"
          />
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="درآمد امروز"
            value={formatToman(todayRevenue._sum.totalPrice ?? 0n, { withUnit: false })}
            hint="تومان"
            icon={<Icon name="money" className="h-4 w-4" />}
          />
          <StatCard
            label="درآمد کل"
            value={formatToman(totalRevenue._sum.totalPrice ?? 0n, { withUnit: false })}
            hint="تومان"
            icon={<Icon name="revenue" className="h-4 w-4" />}
            tone="dark"
          />
          <StatCard
            label="موجودی کیف پول کاربران"
            value={formatToman(walletTotal._sum.balance ?? 0n, { withUnit: false })}
            hint="تومان — بدهی باشگاه"
            icon={<Icon name="bank" className="h-4 w-4" />}
          />
          <StatCard label="زمین‌های فعال" value={formatNumber(courtCount)} icon={<Icon name="court" className="h-4 w-4" />} />
        </section>

        {pendingRequests > 0 && (
          <div className="card flex items-center gap-3 bg-accent-50 p-4 ring-accent-100">
            <Icon name="partner" className="h-5 w-5 text-accent-600" strokeWidth={2.1} />
            <p className="num flex-1 text-xs font-extrabold text-accent-700">
              {toFaDigits(pendingRequests)} درخواست پارتنری در انتظار پاسخ بازیکنان است.
            </p>
          </div>
        )}

        {/* ---- میان‌بر ---- */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickLink href="/admin/users" icon="users" label="مدیریت کاربران" />
          <QuickLink href="/admin/courts" icon="court" label="زمین‌ها و قیمت‌ها" />
          <QuickLink href="/admin/tournaments/new" icon="tournament" label="تورنومنت جدید" />
          <QuickLink href="/admin/finance" icon="revenue" label="گزارش مالی" />
        </section>

        {/* ---- آخرین رزروها ---- */}
        <section>
          <div className="section-title mb-3">
            <h2>آخرین رزروها</h2>
            <Link href="/admin/bookings" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
              مشاهده همه
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="text-xs font-bold text-brand-300">هنوز رزروی ثبت نشده است.</p>
            </div>
          ) : (
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-4">
                  <span className="num flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-[10px] font-black text-brand-600">
                    {formatTime(b.startsAt)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {b.user.profile?.firstName} {b.user.profile?.lastName}
                    </p>
                    <p className="truncate text-[10px] font-semibold text-brand-400">
                      {b.court.name} <Dot />{formatDateTime(b.startsAt, { withWeekday: false })}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="num text-xs font-black text-brand-700">
                      {formatToman(b.totalPrice, { withUnit: false })}
                    </p>
                    <p className="text-[9px] font-bold text-brand-300">
                      {BOOKING_STATUS_LABEL[b.status]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="card-interactive flex cursor-pointer items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="truncate text-xs font-extrabold text-brand-700">{label}</span>
    </Link>
  );
}
