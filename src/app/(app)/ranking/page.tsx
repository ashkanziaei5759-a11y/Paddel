import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { RankingView, type RankRow } from './RankingView';
import { withAlphaFlags } from '@/lib/top-players';

export const metadata: Metadata = { title: 'رنکینگ' };
export const dynamic = 'force-dynamic';

/**
 * جدول رنکینگ باشگاه.
 *
 * «حرکت» هر بازیکن از دفتر کل امتیاز خوانده می‌شود، نه از یک ستون جداگانه:
 * رتبه‌ی امروز با رتبه‌ای که ۳۰ روز پیش داشت مقایسه می‌شود. این‌طور تاریخچه
 * همیشه با موجودی امتیازها سازگار می‌ماند.
 */
const TREND_WINDOW_DAYS = 30;

export default async function RankingPage() {
  const user = await requirePage();
  const since = new Date(Date.now() - TREND_WINDOW_DAYS * 86_400_000);

  const [profiles, unread, recentPoints] = await Promise.all([
    prisma.profile.findMany({
      where: { user: { status: 'ACTIVE', role: { in: ['PLAYER', 'ADMIN'] } } },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        level: true,
        points: true,
        gender: true,
        user: { select: { username: true } },
      },
      orderBy: [{ points: 'desc' }, { firstName: 'asc' }],
      take: 200,
    }),
    unreadCount(user.id),
    prisma.pointsTransaction.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _sum: { amount: true },
    }),
  ]);

  const gained = new Map(recentPoints.map((r) => [r.userId, r._sum.amount ?? 0]));

  /* رتبه‌ی امروز */
  const today = profiles.map((p, i) => ({ ...p, rank: i + 1 }));

  /* رتبه‌ی ۳۰ روز پیش = مرتب‌سازی بر اساس امتیاز منهای آنچه در این بازه گرفته شده */
  const before = [...today]
    .map((p) => ({ userId: p.userId, past: p.points - (gained.get(p.userId) ?? 0) }))
    .sort((a, b) => b.past - a.past);
  const pastRank = new Map(before.map((p, i) => [p.userId, i + 1]));

  const withAlpha = await withAlphaFlags(today);

  const rows: RankRow[] = withAlpha.map((p) => {
    const previous = pastRank.get(p.userId) ?? p.rank;
    return {
      userId: p.userId,
      rank: p.rank,
      firstName: p.firstName,
      lastName: p.lastName,
      username: p.user.username,
      avatarUrl: p.avatarUrl,
      level: p.level,
      points: p.points,
      gender: p.gender,
      avatarHasAlpha: p.avatarHasAlpha,
      delta: previous - p.rank, // مثبت = صعود
      gained: gained.get(p.userId) ?? 0,
    };
  });

  return (
    <>
      <TopBar user={user} unread={unread} title="رنکینگ" subtitle="جدول امتیاز بازیکنان باشگاه" />
      <div className="page-pad pt-1">
        <RankingView rows={rows} viewerId={user.id} />
      </div>
    </>
  );
}
