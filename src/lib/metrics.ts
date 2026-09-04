import { prisma } from '@/lib/db';
import { addDays, startOfLocalDay } from '@/lib/datetime';

/**
 * لایه‌ی آمار باشگاه.
 *
 * داشبورد مالی و صفحه‌ی نمودارها هر دو از همین‌جا عدد می‌گیرند، پس یک عدد در
 * دو صفحه دو جور محاسبه نمی‌شود. همه‌ی مبلغ‌ها ریال‌اند (واحد ذخیره‌سازی) و
 * تبدیل به تومان در لایه‌ی نمایش انجام می‌شود.
 *
 * روزها با startOfLocalDay بریده می‌شوند تا مرز روز، نیمه‌شبِ تهران باشد نه
 * نیمه‌شب UTC؛ وگرنه درآمد شب‌ها به روز بعد می‌افتاد.
 */

export interface DayBucket {
  /** ابتدای روز به وقت محلی */
  day: Date;
  revenue: bigint;
  bookings: number;
  refunds: bigint;
  newUsers: number;
}

export interface PeriodTotals {
  revenue: bigint;
  bookings: number;
  refunds: bigint;
  newUsers: number;
}

export interface ClubMetrics {
  days: DayBucket[];
  current: PeriodTotals;
  /** همان طول دوره، بلافاصله پیش از دوره‌ی جاری — برای درصد تغییر */
  previous: PeriodTotals;
  totals: {
    users: number;
    activeUsers: number;
    courts: number;
    walletBalance: bigint;
    lifetimeRevenue: bigint;
    lifetimeRefunds: bigint;
    openMatches: number;
    activeTournaments: number;
  };
}

const empty = (): PeriodTotals => ({ revenue: 0n, bookings: 0, refunds: 0n, newUsers: 0 });

/** درصد تغییر؛ اگر دوره‌ی قبل صفر بوده، درصد معنا ندارد و undefined برمی‌گردد */
export function percentChange(current: number | bigint, previous: number | bigint) {
  const c = Number(current);
  const p = Number(previous);
  if (p === 0) return undefined;
  return ((c - p) / p) * 100;
}

export async function getClubMetrics(days = 14): Promise<ClubMetrics> {
  const today = startOfLocalDay(new Date());
  const since = addDays(today, -(days - 1));
  /* دوره‌ی مقایسه: به همان طول، درست پیش از دوره‌ی جاری */
  const prevSince = addDays(since, -days);

  const [bookings, cancellations, users, courts, wallet, lifetime, lifetimeRefunds, openMatches, tournaments] =
    await Promise.all([
      prisma.booking.findMany({
        where: { createdAt: { gte: prevSince }, status: { not: 'CANCELLED' } },
        select: { createdAt: true, totalPrice: true },
      }),
      prisma.bookingCancellation.findMany({
        where: { createdAt: { gte: prevSince } },
        select: { createdAt: true, refundAmount: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: prevSince } },
        select: { createdAt: true },
      }),
      prisma.court.count({ where: { isActive: true } }),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.booking.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { totalPrice: true },
      }),
      prisma.bookingCancellation.aggregate({ _sum: { refundAmount: true } }),
      prisma.openMatch.count({ where: { status: { in: ['OPEN', 'FULL'] } } }),
      prisma.tournament.count({
        where: { status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING'] } },
      }),
    ]);

  const [userCount, activeUserCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ]);

  /* سطل‌های روزانه‌ی دوره‌ی جاری */
  const buckets = new Map<number, DayBucket>();
  for (let i = 0; i < days; i += 1) {
    const day = addDays(since, i);
    buckets.set(day.getTime(), { day, revenue: 0n, bookings: 0, refunds: 0n, newUsers: 0 });
  }

  const current = empty();
  const previous = empty();
  const inCurrent = (d: Date) => d.getTime() >= since.getTime();

  const put = (d: Date, apply: (b: DayBucket | PeriodTotals) => void) => {
    if (inCurrent(d)) {
      apply(current);
      const bucket = buckets.get(startOfLocalDay(d).getTime());
      if (bucket) apply(bucket);
    } else {
      apply(previous);
    }
  };

  for (const b of bookings) {
    put(b.createdAt, (t) => {
      t.revenue += b.totalPrice;
      t.bookings += 1;
    });
  }
  for (const c of cancellations) {
    put(c.createdAt, (t) => {
      t.refunds += c.refundAmount;
    });
  }
  for (const u of users) {
    put(u.createdAt, (t) => {
      t.newUsers += 1;
    });
  }

  return {
    days: [...buckets.values()],
    current,
    previous,
    totals: {
      users: userCount,
      activeUsers: activeUserCount,
      courts,
      walletBalance: wallet._sum.balance ?? 0n,
      lifetimeRevenue: lifetime._sum.totalPrice ?? 0n,
      lifetimeRefunds: lifetimeRefunds._sum.refundAmount ?? 0n,
      openMatches,
      activeTournaments: tournaments,
    },
  };
}
