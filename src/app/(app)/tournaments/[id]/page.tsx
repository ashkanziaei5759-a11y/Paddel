import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { StandingsTable, type StandingRow } from '@/components/tournament/StandingsTable';
import { Bracket, type BracketMatch } from '@/components/tournament/Bracket';
import { TeamCard } from '@/components/tournament/TeamCard';
import { RegisterPanel } from './RegisterPanel';
import { unreadCount } from '@/lib/notifications';
import { describeRule } from '@/lib/tournaments/level-rules';
import { formatDateTime, formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';
import {
  MATCH_STAGE_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_TYPE_LABEL,
  rankLabel,
} from '@/lib/constants';

export const metadata: Metadata = { title: 'جزئیات تورنومنت' };
export const dynamic = 'force-dynamic';

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePage();
  const { id } = await params;

  const [tournament, unread] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      include: {
        levelRules: true,
        pointsRules: { orderBy: { rank: 'asc' } },
        courts: { include: { court: { select: { name: true } } } },
        groups: { orderBy: { order: 'asc' } },
        standings: true,
        teams: {
          where: { isActive: true },
          include: {
            members: { include: { user: { include: { profile: true } } } },
            result: true,
          },
        },
        matches: { orderBy: [{ round: 'asc' }, { slotInRound: 'asc' }], include: { court: true } },
      },
    }),
    unreadCount(user.id),
  ]);

  if (!tournament) notFound();
  if (tournament.status === 'DRAFT' && user.role !== 'ADMIN') notFound();

  const teamNameById = new Map(tournament.teams.map((t) => [t.id, t.name]));
  const myMembership = tournament.teams.find((t) => t.members.some((m) => m.userId === user.id));
  const levelRule = tournament.levelRules[0] ?? null;

  const pendingRequest = await prisma.partnerRequest.findFirst({
    where: {
      tournamentId: tournament.id,
      status: 'PENDING',
      OR: [{ senderId: user.id }, { receiverId: user.id }],
    },
    include: {
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  });

  const knockoutMatches = tournament.matches.filter(
    (m) => m.stage !== 'GROUP' && m.stage !== 'LEAGUE',
  );
  const groupOrLeagueMatches = tournament.matches.filter(
    (m) => m.stage === 'GROUP' || m.stage === 'LEAGUE',
  );

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
        highlight: s.teamId === myMembership?.id,
      }));

  const bracketMatches: BracketMatch[] = knockoutMatches.map((m) => ({
    id: m.id,
    stage: m.stage,
    round: m.round,
    slotInRound: m.slotInRound,
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    teamAName: m.teamAId ? (teamNameById.get(m.teamAId) ?? null) : null,
    teamBName: m.teamBId ? (teamNameById.get(m.teamBId) ?? null) : null,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winnerTeamId: m.winnerTeamId,
    status: m.status,
  }));

  const results = tournament.teams
    .filter((t) => t.result)
    .sort((a, b) => (a.result!.finalRank ?? 99) - (b.result!.finalRank ?? 99));

  return (
    <>
      <TopBar
        title={tournament.name}
        subtitle={TOURNAMENT_TYPE_LABEL[tournament.type]}
        unread={unread}
        back="/tournaments"
      />

      <div className="page-pad stagger space-y-4 pt-2">
        {/* ---- هدر ---- */}
        <section className="card-dark p-5">
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-black text-white">{tournament.name}</h1>
              <p className="mt-1 text-[11px] font-bold text-sky-light/70">
                {TOURNAMENT_TYPE_LABEL[tournament.type]}
              </p>
            </div>
            <span className="badge shrink-0 bg-white/15 text-white">
              {TOURNAMENT_STATUS_LABEL[tournament.status]}
            </span>
          </div>

          {tournament.description && (
            <p className="relative mt-3 text-[11px] leading-6 text-sky-light/80">
              {tournament.description}
            </p>
          )}

          <div className="relative mt-4 grid grid-cols-2 gap-3">
            <Info label="شروع" value={formatDateTime(tournament.startsAt, { withWeekday: false })} />
            <Info label="پایان" value={formatDateTime(tournament.endsAt, { withWeekday: false })} />
            <Info
              label="تیم‌ها"
              value={`${toFaDigits(tournament.teams.length)} از ${toFaDigits(tournament.maxTeams)}`}
            />
            <Info
              label="هزینه ثبت‌نام"
              value={tournament.entryFee > 0n ? formatToman(tournament.entryFee) : 'رایگان'}
            />
            {tournament.courts.length > 0 && (
              <Info
                label="زمین‌ها"
                value={tournament.courts.map((c) => c.court.name).join('، ')}
                span
              />
            )}
          </div>
        </section>

        {/* ---- قوانین سطح ---- */}
        <section className="card p-4">
          <h2 className="text-sm font-extrabold text-brand-800">قوانین ترکیب تیم</h2>
          <p className="mt-2 text-[11px] leading-6 text-brand-500">{describeRule(levelRule)}</p>
          {levelRule?.description && (
            <p className="mt-2 rounded-2xl bg-surface-muted px-3 py-2 text-[11px] leading-6 text-brand-500">
              {levelRule.description}
            </p>
          )}
        </section>

        {/* ---- امتیازها ---- */}
        {tournament.pointsRules.length > 0 && (
          <section className="card p-4">
            <h2 className="text-sm font-extrabold text-brand-800">امتیاز تیم‌های برتر ⭐</h2>
            <div className="mt-3 space-y-2">
              {tournament.pointsRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-2.5"
                >
                  <span className="text-xs font-bold text-brand-600">
                    {rule.label || rankLabel(rule.rank)}
                  </span>
                  <span className="num text-xs font-black text-accent-600">
                    {toFaDigits(rule.pointsPerPlayer)} امتیاز برای هر بازیکن
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- ثبت‌نام ---- */}
        <RegisterPanel
          tournamentId={tournament.id}
          status={tournament.status}
          partnerMode={tournament.partnerMode}
          isRegistered={Boolean(myMembership)}
          myTeamName={myMembership?.name ?? null}
          myPartnerName={
            myMembership?.members.find((m) => m.userId !== user.id)?.user.profile
              ? `${myMembership.members.find((m) => m.userId !== user.id)!.user.profile!.firstName} ${myMembership.members.find((m) => m.userId !== user.id)!.user.profile!.lastName}`
              : null
          }
          entryFee={tournament.entryFee.toString()}
          isFull={tournament.teams.length >= tournament.maxTeams}
          levelRuleText={describeRule(levelRule)}
          pendingRequest={
            pendingRequest
              ? {
                  id: pendingRequest.id,
                  isSender: pendingRequest.senderId === user.id,
                  otherName: pendingRequest.senderId === user.id
                    ? `${pendingRequest.receiver.profile?.firstName ?? ''} ${pendingRequest.receiver.profile?.lastName ?? ''}`.trim()
                    : `${pendingRequest.sender.profile?.firstName ?? ''} ${pendingRequest.sender.profile?.lastName ?? ''}`.trim(),
                }
              : null
          }
        />

        {/* ---- تیم‌ها ---- */}
        {tournament.teams.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">
              تیم‌های شرکت‌کننده
              <span className="num mr-2 text-xs font-bold text-brand-300">
                ({toFaDigits(tournament.teams.length)})
              </span>
            </h2>
            <div className="space-y-2">
              {tournament.teams.map((team) => (
                <TeamCard
                  key={team.id}
                  highlight={team.id === myMembership?.id}
                  rankLabel={team.result ? rankLabel(team.result.finalRank) : undefined}
                  team={{
                    id: team.id,
                    name: team.name,
                    members: team.members.map((m) => ({
                      userId: m.userId,
                      firstName: m.user.profile?.firstName ?? '؟',
                      lastName: m.user.profile?.lastName ?? '',
                      avatarUrl: m.user.profile?.avatarUrl ?? null,
                      level: m.user.profile?.level ?? null,
                      isLeader: m.isLeader,
                    })),
                  }}
                />
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

        {/* ---- براکت ---- */}
        {bracketMatches.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">مرحله حذفی</h2>
            <Bracket matches={bracketMatches} />
          </section>
        )}

        {/* ---- برنامه مسابقات ---- */}
        {groupOrLeagueMatches.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">برنامه مسابقات</h2>
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {groupOrLeagueMatches.slice(0, 40).map((m) => (
                <div key={m.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-brand-300">
                    <span>
                      {MATCH_STAGE_LABEL[m.stage]} <Dot />دور {toFaDigits(m.round)}
                    </span>
                    {m.scheduledAt && (
                      <span className="num">
                        {formatJalaliDate(m.scheduledAt, { short: true })} {formatTime(m.scheduledAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex-1 truncate text-right text-xs font-bold text-brand-700">
                      {m.teamAId ? teamNameById.get(m.teamAId) : '—'}
                    </span>
                    <span className="num shrink-0 rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-black text-brand-800">
                      {m.status === 'COMPLETED'
                        ? `${toFaDigits(m.scoreA ?? 0)} − ${toFaDigits(m.scoreB ?? 0)}`
                        : 'vs'}
                    </span>
                    <span className="flex-1 truncate text-left text-xs font-bold text-brand-700">
                      {m.teamBId ? teamNameById.get(m.teamBId) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- نتایج نهایی ---- */}
        {results.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">نتایج نهایی 🏅</h2>
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {results.slice(0, 8).map((team) => (
                <div key={team.id} className="flex items-center gap-3 p-4">
                  <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-xs font-black text-accent-700">
                    {toFaDigits(team.result!.finalRank)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">{team.name}</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-brand-400">
                      {team.members
                        .map((m) => `${m.user.profile?.firstName} ${m.user.profile?.lastName}`)
                        .join(' و ')}
                    </p>
                  </div>
                  {team.result!.pointsAwarded > 0 && (
                    <span className="badge-accent num shrink-0">
                      +{toFaDigits(team.result!.pointsAwarded)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Info({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : undefined}>
      <p className="text-[10px] font-bold text-sky-light/60">{label}</p>
      <p className="num mt-1 text-[11px] font-black text-white">{value}</p>
    </div>
  );
}
