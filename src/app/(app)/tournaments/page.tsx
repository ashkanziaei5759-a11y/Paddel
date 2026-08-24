import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { dayKey } from '@/lib/datetime';
import { TOURNAMENT_TYPE_LABEL } from '@/lib/constants';
import { TournamentsView, type TournamentDto } from './TournamentsView';

export const metadata: Metadata = { title: 'تورنومنت‌ها' };
export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
  const user = await requirePage();

  const [tournaments, unread] = await Promise.all([
    prisma.tournament.findMany({
      where: user.role === 'ADMIN' ? {} : { status: { not: 'DRAFT' } },
      orderBy: { startsAt: 'desc' },
      take: 80,
      include: {
        teams: {
          where: { isActive: true },
          include: {
            members: { include: { user: { include: { profile: true } } } },
            result: true,
          },
        },
      },
    }),
    unreadCount(user.id),
  ]);

  const dto: TournamentDto[] = tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    typeLabel: TOURNAMENT_TYPE_LABEL[t.type],
    status: t.status,
    startsAt: t.startsAt.toISOString(),
    dayKey: dayKey(t.startsAt),
    maxTeams: t.maxTeams,
    entryFee: t.entryFee.toString(),
    teams: t.teams.map((team) => ({
      id: team.id,
      name: team.name,
      rank: team.result?.finalRank ?? null,
      points: team.result?.pointsAwarded ?? null,
      members: team.members
        .sort((a, b) => a.slot - b.slot)
        .map((m) => ({
          userId: m.userId,
          firstName: m.user.profile?.firstName ?? '؟',
          lastName: m.user.profile?.lastName ?? '',
          avatarUrl: m.user.profile?.avatarUrl ?? null,
          level: m.user.profile?.level ?? null,
          isLeader: m.isLeader,
        })),
    })),
    joined: t.teams.some((team) => team.members.some((m) => m.userId === user.id)),
  }));

  return (
    <>
      <TopBar title="تورنومنت‌ها" subtitle="مسابقات باشگاه پرشین پدل" unread={unread} />
      <div className="page-pad pt-2">
        <TournamentsView tournaments={dto} todayKey={dayKey(new Date())} />
      </div>
    </>
  );
}
