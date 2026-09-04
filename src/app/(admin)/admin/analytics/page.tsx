import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import {
  BarSeries,
  DistributionBars,
  GroupedBars,
  KpiTile,
  RankBars,
} from '@/components/admin/charts/Charts';
import { LEVEL_LABEL } from '@/lib/constants';
import { getClubMetrics, percentChange } from '@/lib/metrics';
import { toFaDigits } from '@/lib/datetime';
import { formatNumber, formatToman, rialToToman } from '@/lib/utils';
import type { PlayerLevel } from '@prisma/client';

export const metadata: Metadata = { title: 'نمودارها' };
export const dynamic = 'force-dynamic';

const DAYS = 14;
const WEEKDAY = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

/**
 * داشبورد نموداری باشگاه.
 *
 * هر عدد هم به شکل کاشی (متن) و هم روی نمودار دیده می‌شود، چون خواندن یک عدد
 * دقیق از روی ستون ممکن نیست و دیدن روند از روی عدد هم ممکن نیست.
 */
export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  const [metrics, topPlayers, courts, levels, topSpenders, courtBookings] = await Promise.all([
    getClubMetrics(DAYS),
    prisma.profile.findMany({
      where: { user: { role: 'PLAYER', status: 'ACTIVE' } },
      orderBy: { points: 'desc' },
      take: 8,
      select: { userId: true, firstName: true, lastName: true, points: true, level: true },
    }),
    prisma.court.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.profile.groupBy({ by: ['level'], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ['userId'],
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
      _count: { _all: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 8,
    }),
    prisma.booking.groupBy({
      by: ['courtId'],
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
  ]);

  const spenderProfiles = await prisma.profile.findMany({
    where: { userId: { in: topSpenders.map((s) => s.userId) } },
    select: { userId: true, firstName: true, lastName: true },
  });
  const nameOf = new Map(
    spenderProfiles.map((p) => [p.userId, `${p.firstName} ${p.lastName}`] as const),
  );

  const labels = metrics.days.map((d) => WEEKDAY[d.day.getDay()] ?? '');
  const revenueToman = metrics.days.map((d) => Number(rialToToman(d.revenue)));
  const refundToman = metrics.days.map((d) => Number(rialToToman(d.refunds)));
  const bookingCounts = metrics.days.map((d) => d.bookings);
  const newUsers = metrics.days.map((d) => d.newUsers);

  const levelOrder = Object.keys(LEVEL_LABEL) as PlayerLevel[];
  const levelCounts = new Map(levels.map((l) => [l.level, l._count._all] as const));

  const bookingsByCourt = new Map(courtBookings.map((c) => [c.courtId, c] as const));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-black text-brand-800">نمودارها</h1>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          روند {toFaDigits(DAYS)} روز گذشته در کنار دوره‌ی پیش از آن، و رتبه‌بندی بازیکنان و زمین‌ها.
        </p>
      </header>

      {/* ---- کاشی‌های عددی ---- */}
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          label={`درآمد ${toFaDigits(DAYS)} روز`}
          value={formatToman(metrics.current.revenue)}
          delta={percentChange(metrics.current.revenue, metrics.previous.revenue)}
          spark={revenueToman}
          tone="accent"
        />
        <KpiTile
          label="تعداد رزرو"
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
          label="کل کاربران"
          value={formatNumber(metrics.totals.users)}
          hint={`${formatNumber(metrics.totals.activeUsers)} فعال`}
        />
        <KpiTile
          label="بازی‌های باز"
          value={formatNumber(metrics.totals.openMatches)}
          hint="در انتظار بازیکن یا تکمیل"
        />
        <KpiTile
          label="تورنومنت‌های جاری"
          value={formatNumber(metrics.totals.activeTournaments)}
          hint={`${formatNumber(metrics.totals.courts)} زمین فعال`}
        />
      </div>

      <BarSeries
        title="درآمد روزانه"
        subtitle={`مجموع ${toFaDigits(DAYS)} روز گذشته`}
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

      <BarSeries
        title="کاربران تازه در هر روز"
        subtitle="ثبت‌نام‌های جدید"
        points={metrics.days.map((d, i) => ({ label: labels[i], value: newUsers[i] }))}
        format={(v) => formatNumber(v)}
        accent="success"
      />

      <GroupedBars
        title="درآمد در برابر بازگشت وجه"
        subtitle="روزبه‌روز، به تومان"
        labels={labels}
        seriesA={{ name: 'درآمد', values: revenueToman }}
        seriesB={{ name: 'بازگشت', values: refundToman }}
        format={(v) => formatToman(BigInt(Math.round(v)) * 10n)}
      />

      <RankBars
        title="بازیکنان برتر"
        subtitle="بر اساس امتیاز رنکینگ"
        rows={topPlayers.map((p) => ({
          id: p.userId,
          name: `${p.firstName} ${p.lastName}`,
          meta: LEVEL_LABEL[p.level],
          value: p.points,
        }))}
        format={(v) => `${formatNumber(v)} امتیاز`}
        emptyText="هنوز بازیکنی امتیاز نگرفته است."
      />

      <RankBars
        title="بیشترین هزینه‌ی رزرو"
        subtitle="در تمام دوره‌ها"
        rows={topSpenders.map((s) => ({
          id: s.userId,
          name: nameOf.get(s.userId) ?? '—',
          meta: `${formatNumber(s._count._all)} رزرو`,
          value: Number(rialToToman(s._sum.totalPrice ?? 0n)),
        }))}
        format={(v) => formatToman(BigInt(Math.round(v)) * 10n)}
        emptyText="هنوز رزروی ثبت نشده است."
      />

      <RankBars
        title="پردرآمدترین زمین‌ها"
        subtitle="در تمام دوره‌ها"
        rows={courts
          .map((c) => {
            const row = bookingsByCourt.get(c.id);
            return {
              id: c.id,
              name: c.name,
              meta: `${formatNumber(row?._count._all ?? 0)} رزرو`,
              value: Number(rialToToman(row?._sum.totalPrice ?? 0n)),
            };
          })
          .sort((a, b) => b.value - a.value)}
        format={(v) => formatToman(BigInt(Math.round(v)) * 10n)}
        emptyText="زمین فعالی وجود ندارد."
      />

      <DistributionBars
        title="توزیع سطح بازیکنان"
        subtitle="چند بازیکن در هر سطح"
        rows={levelOrder.map((lvl) => ({
          label: LEVEL_LABEL[lvl],
          value: levelCounts.get(lvl) ?? 0,
        }))}
      />
    </div>
  );
}
