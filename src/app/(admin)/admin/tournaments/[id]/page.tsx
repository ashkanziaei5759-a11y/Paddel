import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { TournamentForm, type TournamentFormValues } from '@/components/admin/TournamentForm';
import { TournamentOps } from './TournamentOps';
import { MatchResults } from './MatchResults';
import { StandingsTable, type StandingRow } from '@/components/tournament/StandingsTable';
import { iso, rialToToman } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';
import { LEVEL_LABEL, TOURNAMENT_STATUS_LABEL, rankLabel } from '@/lib/constants';
import type { PlayerLevel } from '@prisma/client';

export const metadata: Metadata = { title: 'مدیریت تورنومنت' };
export const dynamic = 'force-dynamic';

function parseCombinations(value: unknown): { slot1: PlayerLevel; slot2: PlayerLevel }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const r = item as Record<string, unknown>;
    if (typeof r.slot1 !== 'string' || typeof r.slot2 !== 'string') return [];
    return [{ slot1: r.slot1 as PlayerLevel, slot2: r.slot2 as PlayerLevel }];
  });
}

export default async function AdminTournamentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tournament, courts] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      include: {
        levelRules: true,
        pointsRules: { orderBy: { rank: 'asc' } },
        courts: true,
        groups: { orderBy: { order: 'asc' } },
        standings: true,
        teams: {
          where: { isActive: true },
          include: {
            members: { include: { user: { include: { profile: true } } } },
            result: true,
          },
        },
        matches: { orderBy: [{ stage: 'asc' }, { round: 'asc' }, { slotInRound: 'asc' }] },
      },
    }),
    prisma.court.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!tournament) notFound();

  const rule = tournament.levelRules[0] ?? null;
  const teamNameById = new Map(tournament.teams.map((t) => [t.id, t.name]));

  const initial: TournamentFormValues = {
    id: tournament.id,
    name: tournament.name,
    description: tournament.description ?? '',
    type: tournament.type,
    status: tournament.status,
    startsAt: tournament.startsAt.toISOString(),
    endsAt: tournament.endsAt.toISOString(),
    registrationClosesAt: tournament.registrationClosesAt?.toISOString() ?? '',
    maxTeams: tournament.maxTeams,
    minTeams: tournament.minTeams,
    entryFeeToman: rialToToman(tournament.entryFee),
    splitFeeBetweenPartners: tournament.splitFeeBetweenPartners,
    partnerMode: tournament.partnerMode,
    courtIds: tournament.courts.map((c) => c.courtId),
    groupCount: tournament.groupCount ?? 2,
    advancingPerGroup: tournament.advancingPerGroup ?? 2,
    hasThirdPlaceMatch: tournament.hasThirdPlaceMatch,
    doubleRoundRobin: tournament.doubleRoundRobin,
    pointsForWin: tournament.pointsForWin,
    pointsForDraw: tournament.pointsForDraw,
    pointsForLoss: tournament.pointsForLoss,
    levelRuleType: rule?.type ?? 'FREE',
    slot1Levels: rule?.slot1Levels ?? [],
    slot2Levels: rule?.slot2Levels ?? [],
    combinations: parseCombinations(rule?.combinations),
    orderInsensitive: rule?.orderInsensitive ?? true,
    levelRuleDescription: rule?.description ?? '',
    pointsRules: tournament.pointsRules.map((r) => ({
      rank: r.rank,
      pointsPerPlayer: r.pointsPerPlayer,
      label: r.label,
    })),
  };

  const standingRows = (groupId: string | null): StandingRow[] =>
    tournament.standings
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .map((s) => ({
        teamId: s.teamId,
        teamName: teamNameById.get(s.teamId) ?? '—',
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        setsFor: s.setsFor,
        setsAgainst: s.setsAgainst,
        points: s.points,
        rank: s.rank,
      }));

  return (
    <>
      <AdminHeader
        title={tournament.name}
        subtitle={`${TOURNAMENT_STATUS_LABEL[tournament.status]} · ${iso(toFaDigits(tournament.teams.length))} تیم`}
        action={
          <div className="flex gap-2">
            <Link href={`/tournaments/${tournament.id}`} className="btn-outline btn-sm">
              نمای بازیکن
            </Link>
            <Link href="/admin/tournaments" className="btn-outline btn-sm">
              بازگشت
            </Link>
          </div>
        }
      />

      <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <TournamentOps
          tournamentId={tournament.id}
          type={tournament.type}
          status={tournament.status}
          teamCount={tournament.teams.length}
          matchCount={tournament.matches.length}
          hasResults={tournament.teams.some((t) => t.result)}
        />

        {/* ---- تیم‌ها ---- */}
        {tournament.teams.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">
              تیم‌های ثبت‌نام‌شده ({toFaDigits(tournament.teams.length)})
            </h2>
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {tournament.teams.map((team) => (
                <div key={team.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-extrabold text-brand-800">{team.name}</p>
                    {team.result && (
                      <span className="badge-accent shrink-0">{rankLabel(team.result.finalRank)}</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {team.members.map((m) => (
                      <Link
                        key={m.id}
                        href={`/admin/users/${m.userId}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted px-2.5 py-1.5 transition hover:bg-brand-50"
                      >
                        <span className="truncate text-[11px] font-bold text-brand-600">
                          {m.user.profile?.firstName} {m.user.profile?.lastName}
                          {m.isLeader && ' 👑'}
                        </span>
                        {m.user.profile && (
                          <span dir="ltr" className="shrink-0 text-[10px] font-black text-brand-400">
                            {LEVEL_LABEL[m.user.profile.level]}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- جدول ---- */}
        {tournament.standings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold text-brand-800">جدول رده‌بندی</h2>
            {tournament.groups.length > 0 ? (
              tournament.groups.map((g) => (
                <StandingsTable key={g.id} title={g.name} rows={standingRows(g.id)} />
              ))
            ) : (
              <StandingsTable rows={standingRows(null)} />
            )}
          </section>
        )}

        {/* ---- ثبت نتایج ---- */}
        {tournament.matches.length > 0 && (
          <MatchResults
            tournamentId={tournament.id}
            matches={tournament.matches.map((m) => ({
              id: m.id,
              stage: m.stage,
              round: m.round,
              slotInRound: m.slotInRound,
              status: m.status,
              teamAId: m.teamAId,
              teamBId: m.teamBId,
              teamAName: m.teamAId ? (teamNameById.get(m.teamAId) ?? null) : null,
              teamBName: m.teamBId ? (teamNameById.get(m.teamBId) ?? null) : null,
              scoreA: m.scoreA,
              scoreB: m.scoreB,
            }))}
          />
        )}

        {/* ---- ویرایش ---- */}
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">ویرایش تورنومنت</h2>
          <TournamentForm courts={courts} initial={initial} />
        </section>
      </div>
    </>
  );
}
