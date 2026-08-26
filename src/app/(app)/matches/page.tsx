import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { MatchesView } from './MatchesView';
import type { MatchDto } from '@/components/match/MatchCard';

export const metadata: Metadata = { title: 'بازی‌های باز' };
export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  const user = await requirePage();

  const [matches, unread, openBookings] = await Promise.all([
    prisma.openMatch.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        booking: { status: 'CONFIRMED', startsAt: { gt: new Date() } },
      },
      include: {
        booking: { include: { court: { select: { name: true } } } },
        players: {
          include: { user: { include: { profile: true } } },
          orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
        },
      },
      orderBy: { booking: { startsAt: 'asc' } },
      take: 60,
    }),
    unreadCount(user.id),
    /* رزروهای آینده‌ی کاربر که هنوز بازی بازی رویشان ساخته نشده */
    prisma.booking.findMany({
      where: {
        userId: user.id,
        status: 'CONFIRMED',
        startsAt: { gt: new Date() },
        openMatch: { is: null },
      },
      include: { court: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
      take: 10,
    }),
  ]);

  const dto: MatchDto[] = matches.map((m) => ({
    id: m.id,
    code: m.code,
    courtName: m.booking.court.name,
    startsAt: m.booking.startsAt.toISOString(),
    endsAt: m.booking.endsAt.toISOString(),
    capacity: m.capacity,
    share: m.sharePerPlayer.toString(),
    levelPolicy: m.levelPolicy,
    allowedLevels: m.allowedLevels,
    notes: m.notes,
    status: m.status,
    players: m.players.map((p) => ({
      userId: p.userId,
      firstName: p.user.profile?.firstName ?? '؟',
      lastName: p.user.profile?.lastName ?? '',
      avatarUrl: p.user.profile?.avatarUrl ?? null,
      level: p.user.profile?.level ?? null,
      isHost: p.isHost,
    })),
  }));

  return (
    <>
      <TopBar
        user={user}
        unread={unread}
        title="بازی‌های باز"
        subtitle="به بازی دیگران بپیوندید یا زمین خودتان را باز کنید"
      />
      <div className="page-pad pt-1">
        <MatchesView
          matches={dto}
          viewerId={user.id}
          viewerLevel={user.level}
          openBookings={openBookings.map((b) => ({
            id: b.id,
            courtName: b.court.name,
            startsAt: b.startsAt.toISOString(),
            totalPrice: b.totalPrice.toString(),
          }))}
        />
      </div>
    </>
  );
}
