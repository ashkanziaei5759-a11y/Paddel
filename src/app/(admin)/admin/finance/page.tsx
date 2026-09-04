import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StatCard } from '@/components/ui/StatCard';
import { addDays, formatDateTime, startOfLocalDay, toFaDigits } from '@/lib/datetime';
import { formatNumber, formatToman, rialToToman } from '@/lib/utils';
import { getClubMetrics, percentChange } from '@/lib/metrics';
import {
  BarSeries,
  DistributionBars,
  GroupedBars,
  KpiTile,
} from '@/components/admin/charts/Charts';
import { PAYMENT_STATUS_LABEL, WALLET_TX_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'گزارش مالی' };
export const dynamic = 'force-dynamic';

const DAYS = 14;
const WEEKDAY = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

export default async function AdminFinancePage() {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = addDays(todayStart, -7);
  const monthStart = addDays(todayStart, -30);

  const [
    todayRevenue,
    weekRevenue,
    monthRevenue,
    totalRevenue,
    totalRefunds,
    successfulPayments,
    walletTotal,
    recentPayments,
    recentTransactions,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true }, _count: true,
    }),
    prisma.booking.aggregate({
      where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true }, _count: true,
    }),
    prisma.booking.aggregate({
      where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true }, _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true }, _count: true,
    }),
    prisma.bookingCancellation.aggregate({ _sum: { refundAmount: true, penaltyAmount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true }, _count: true }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { user: { include: { profile: true } } },
    }),
    prisma.walletTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { include: { profile: true } } },
    }),
  ]);

  /* روند روزانه و دوره‌ی مقایسه — از همان لایه‌ای که صفحه‌ی نمودارها می‌خواند،
     تا یک عدد در دو صفحه دو جور محاسبه نشود */
  const [metrics, paymentsByStatus, txByType] = await Promise.all([
    getClubMetrics(DAYS),
    prisma.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
    prisma.walletTransaction.groupBy({ by: ['type'], _count: { _all: true } }),
  ]);

  const labels = metrics.days.map((d) => WEEKDAY[d.day.getDay()] ?? '');
  const revenueToman = metrics.days.map((d) => Number(rialToToman(d.revenue)));
  const refundToman = metrics.days.map((d) => Number(rialToToman(d.refunds)));
  const bookingCounts = metrics.days.map((d) => d.bookings);

  /* سود ناخالص = درآمد رزرو منهای بازگشت وجه */
  const netCurrent = metrics.current.revenue - metrics.current.refunds;
  const netPrevious = metrics.previous.revenue - metrics.previous.refunds;

  return (
    <>
      <AdminHeader title="گزارش مالی" subtitle="درآمد، پرداخت‌ها و کیف پول کاربران" />

      <div className="stagger space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {/* ---- روند دوره: عدد، درصد تغییر و شکل روند کنار هم ---- */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label={`درآمد ${toFaDigits(DAYS)} روز`}
            value={formatToman(metrics.current.revenue)}
            delta={percentChange(metrics.current.revenue, metrics.previous.revenue)}
            spark={revenueToman}
            tone="accent"
          />
          <KpiTile
            label={`بازگشت وجه ${toFaDigits(DAYS)} روز`}
            value={formatToman(metrics.current.refunds)}
            delta={percentChange(metrics.current.refunds, metrics.previous.refunds)}
            spark={refundToman}
          />
          <KpiTile
            label="درآمد خالص دوره"
            value={formatToman(netCurrent)}
            delta={percentChange(netCurrent, netPrevious)}
            tone="success"
          />
          <KpiTile
            label="تعداد رزرو دوره"
            value={formatNumber(metrics.current.bookings)}
            delta={percentChange(metrics.current.bookings, metrics.previous.bookings)}
            spark={bookingCounts}
          />
        </section>

        <GroupedBars
          title="درآمد در برابر بازگشت وجه"
          subtitle={`${toFaDigits(DAYS)} روز گذشته، به تومان`}
          labels={labels}
          seriesA={{ name: 'درآمد', values: revenueToman }}
          seriesB={{ name: 'بازگشت', values: refundToman }}
          format={(v) => formatToman(BigInt(Math.round(v)) * 10n)}
        />

        <BarSeries
          title="تعداد رزرو روزانه"
          subtitle="رزروهای ثبت‌شده در هر روز"
          points={metrics.days.map((d, i) => ({ label: labels[i], value: bookingCounts[i] }))}
          format={(v) => formatNumber(v)}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionBars
            title="وضعیت پرداخت‌های درگاه"
            subtitle="چند تراکنش در هر وضعیت"
            rows={paymentsByStatus.map((p) => ({
              label: PAYMENT_STATUS_LABEL[p.status] ?? p.status,
              value: p._count._all,
            }))}
            emptyText="هنوز پرداختی از درگاه ثبت نشده است."
          />
          <DistributionBars
            title="تراکنش‌های کیف پول به تفکیک نوع"
            subtitle="چند تراکنش از هر نوع"
            rows={txByType
              .map((t) => ({ label: WALLET_TX_LABEL[t.type] ?? t.type, value: t._count._all }))
              .sort((a, b) => b.value - a.value)}
          />
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="درآمد امروز"
            value={formatToman(todayRevenue._sum.totalPrice ?? 0n, { withUnit: false })}
            hint={`${toFaDigits(todayRevenue._count)} رزرو`}
            icon={<Icon name="money" className="h-4 w-4" />}
            tone="dark"
          />
          <StatCard
            label="درآمد ۷ روز اخیر"
            value={formatToman(weekRevenue._sum.totalPrice ?? 0n, { withUnit: false })}
            hint={`${toFaDigits(weekRevenue._count)} رزرو`}
            icon={<Icon name="revenue" className="h-4 w-4" />}
          />
          <StatCard
            label="درآمد ۳۰ روز اخیر"
            value={formatToman(monthRevenue._sum.totalPrice ?? 0n, { withUnit: false })}
            hint={`${toFaDigits(monthRevenue._count)} رزرو`}
            icon={<Icon name="revenue" className="h-4 w-4" />}
          />
          <StatCard
            label="درآمد کل"
            value={formatToman(totalRevenue._sum.totalPrice ?? 0n, { withUnit: false })}
            hint={`${toFaDigits(totalRevenue._count)} رزرو`}
            icon={<Icon name="revenue" className="h-4 w-4" />}
            tone="accent"
          />
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="شارژ موفق درگاه"
            value={formatToman(successfulPayments._sum.amount ?? 0n, { withUnit: false })}
            hint={`${toFaDigits(successfulPayments._count)} تراکنش`}
            icon={<Icon name="bank" className="h-4 w-4" />}
          />
          <StatCard
            label="موجودی کیف پول کاربران"
            value={formatToman(walletTotal._sum.balance ?? 0n, { withUnit: false })}
            hint="تعهد باشگاه"
            icon={<Icon name="wallet" className="h-4 w-4" />}
          />
          <StatCard
            label="مجموع بازگشت وجه"
            value={formatToman(totalRefunds._sum.refundAmount ?? 0n, { withUnit: false })}
            hint={`${toFaDigits(totalRefunds._count)} لغو`}
            icon={<Icon name="receipt" className="h-4 w-4" />}
          />
          <StatCard
            label="جریمه‌های لغو"
            value={formatToman(totalRefunds._sum.penaltyAmount ?? 0n, { withUnit: false })}
            hint="درآمد ناشی از لغو"
            icon={<Icon name="pricing" className="h-4 w-4" />}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">آخرین پرداخت‌های درگاه</h2>
          {recentPayments.length === 0 ? (
            <Empty text="پرداختی ثبت نشده است." />
          ) : (
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {p.user.profile?.firstName} {p.user.profile?.lastName}
                    </p>
                    <p className="num truncate text-[10px] font-semibold text-brand-400">
                      {p.provider} <Dot />{formatDateTime(p.createdAt, { withWeekday: false })}
                      {p.providerVerifyRef && <><Dot />{p.providerVerifyRef}</>}
                    </p>
                  </div>
                  <span className="num shrink-0 text-xs font-black text-brand-700">
                    {formatToman(p.amount, { withUnit: false })}
                  </span>
                  <span
                    className={cn(
                      'shrink-0',
                      p.status === 'SUCCESS'
                        ? 'badge-success'
                        : p.status === 'FAILED' || p.status === 'CANCELLED'
                          ? 'badge-danger'
                          : 'badge-muted',
                    )}
                  >
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">آخرین تراکنش‌های کیف پول</h2>
          {recentTransactions.length === 0 ? (
            <Empty text="تراکنشی ثبت نشده است." />
          ) : (
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {tx.user.profile?.firstName} {tx.user.profile?.lastName}
                    </p>
                    <p className="truncate text-[10px] font-semibold text-brand-400">
                      {tx.description || WALLET_TX_LABEL[tx.type]} <Dot />
                      {formatDateTime(tx.createdAt, { withWeekday: false })}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p
                      className={cn(
                        'num text-xs font-black',
                        tx.amount > 0n ? 'text-success' : 'text-brand-700',
                      )}
                    >
                      {tx.amount > 0n ? '+' : '−'}
                      {formatToman(tx.amount < 0n ? -tx.amount : tx.amount, { withUnit: false })}
                    </p>
                    <p className="num text-[9px] font-bold text-brand-300">
                      مانده {formatNumber(Number(tx.balanceAfter) / 10)}
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

function Empty({ text }: { text: string }) {
  return (
    <div className="card px-6 py-8 text-center">
      <p className="text-xs font-bold text-brand-300">{text}</p>
    </div>
  );
}
