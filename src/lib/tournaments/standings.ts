import 'server-only';
import type { Prisma, TournamentMatch } from '@prisma/client';
import { prisma } from '@/lib/db';

interface SetScore {
  a: number;
  b: number;
}

function parseSets(value: unknown): SetScore[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const rec = item as Record<string, unknown>;
    if (typeof rec.a !== 'number' || typeof rec.b !== 'number') return [];
    return [{ a: rec.a, b: rec.b }];
  });
}

interface Row {
  teamId: string;
  groupId: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
}

/** بازسازی کامل جدول از روی نتایج ثبت‌شده — همیشه سازگار و قابل اتکا */
export async function recomputeStandings(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: { where: { isActive: true } },
      matches: { where: { status: { in: ['COMPLETED', 'WALKOVER'] } } },
    },
  });
  if (!tournament) return;

  const rows = new Map<string, Row>();
  for (const team of tournament.teams) {
    rows.set(team.id, {
      teamId: team.id,
      groupId: team.groupId,
      played: 0, won: 0, drawn: 0, lost: 0,
      setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0,
      points: 0,
    });
  }

  const relevant = tournament.matches.filter(
    (m) => m.stage === 'LEAGUE' || m.stage === 'GROUP',
  );

  for (const match of relevant) {
    applyMatch(rows, match, tournament.pointsForWin, tournament.pointsForDraw, tournament.pointsForLoss);
  }

  const list = [...rows.values()];
  const ranked = rankRows(list);

  await prisma.$transaction(
    ranked.map((row) =>
      prisma.tournamentStanding.upsert({
        where: { teamId: row.teamId },
        create: {
          tournamentId,
          teamId: row.teamId,
          groupId: row.groupId,
          played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
          setsFor: row.setsFor, setsAgainst: row.setsAgainst,
          gamesFor: row.gamesFor, gamesAgainst: row.gamesAgainst,
          points: row.points, rank: row.rank,
        },
        update: {
          groupId: row.groupId,
          played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
          setsFor: row.setsFor, setsAgainst: row.setsAgainst,
          gamesFor: row.gamesFor, gamesAgainst: row.gamesAgainst,
          points: row.points, rank: row.rank,
        },
      }),
    ),
  );
}

function applyMatch(
  rows: Map<string, Row>,
  match: TournamentMatch,
  pWin: number,
  pDraw: number,
  pLoss: number,
) {
  if (!match.teamAId || !match.teamBId) return;
  const a = rows.get(match.teamAId);
  const b = rows.get(match.teamBId);
  if (!a || !b) return;

  const sets = parseSets(match.setScores);
  const setsA = sets.length ? sets.filter((s) => s.a > s.b).length : (match.scoreA ?? 0);
  const setsB = sets.length ? sets.filter((s) => s.b > s.a).length : (match.scoreB ?? 0);
  const gamesA = sets.reduce((sum, s) => sum + s.a, 0);
  const gamesB = sets.reduce((sum, s) => sum + s.b, 0);

  a.played += 1;
  b.played += 1;
  a.setsFor += setsA; a.setsAgainst += setsB;
  b.setsFor += setsB; b.setsAgainst += setsA;
  a.gamesFor += gamesA; a.gamesAgainst += gamesB;
  b.gamesFor += gamesB; b.gamesAgainst += gamesA;

  const winnerId = match.winnerTeamId ?? (setsA > setsB ? match.teamAId : setsB > setsA ? match.teamBId : null);

  if (winnerId === match.teamAId) {
    a.won += 1; a.points += pWin;
    b.lost += 1; b.points += pLoss;
  } else if (winnerId === match.teamBId) {
    b.won += 1; b.points += pWin;
    a.lost += 1; a.points += pLoss;
  } else {
    a.drawn += 1; a.points += pDraw;
    b.drawn += 1; b.points += pDraw;
  }
}

type RankedRow = Row & { rank: number };

/**
 * ترتیب: امتیاز ← تفاضل ست ← ست‌های برده ← تفاضل گیم ← گیم‌های برده.
 * رتبه‌بندی درون هر گروه جداگانه انجام می‌شود.
 */
export function rankRows(rows: Row[]): RankedRow[] {
  const byGroup = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.groupId ?? '__all__';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(row);
  }

  const out: RankedRow[] = [];
  for (const group of byGroup.values()) {
    group
      .sort(compareRows)
      .forEach((row, index) => out.push({ ...row, rank: index + 1 }));
  }
  return out;
}

export function compareRows(a: Row, b: Row): number {
  if (b.points !== a.points) return b.points - a.points;
  const setDiffA = a.setsFor - a.setsAgainst;
  const setDiffB = b.setsFor - b.setsAgainst;
  if (setDiffB !== setDiffA) return setDiffB - setDiffA;
  if (b.setsFor !== a.setsFor) return b.setsFor - a.setsFor;
  const gameDiffA = a.gamesFor - a.gamesAgainst;
  const gameDiffB = b.gamesFor - b.gamesAgainst;
  if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
  return b.gamesFor - a.gamesFor;
}

/**
 * انتقال تیم‌های صعودکننده از گروه‌ها به براکت حذفی.
 * سیدبندی: ابتدا صدرنشین‌های گروه‌ها، سپس نفرات دوم و ... .
 */
export async function populateKnockout(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: { orderBy: { order: 'asc' } },
      standings: true,
      matches: { orderBy: [{ round: 'asc' }, { slotInRound: 'asc' }] },
    },
  });
  if (!tournament) return;

  const advancing = tournament.advancingPerGroup ?? 2;
  const qualified: string[] = [];

  for (let position = 1; position <= advancing; position += 1) {
    for (const group of tournament.groups) {
      const row = tournament.standings.find((s) => s.groupId === group.id && s.rank === position);
      if (row) qualified.push(row.teamId);
    }
  }

  const knockoutMatches = tournament.matches.filter(
    (m) => m.stage !== 'GROUP' && m.stage !== 'LEAGUE' && m.stage !== 'THIRD_PLACE',
  );
  if (knockoutMatches.length === 0 || qualified.length < 2) return;

  const firstRound = Math.min(...knockoutMatches.map((m) => m.round));
  const openers = knockoutMatches
    .filter((m) => m.round === firstRound)
    .sort((a, b) => a.slotInRound - b.slotInRound);

  const size = openers.length * 2;
  const { seedOrder } = await import('./schedule');
  const order = seedOrder(size);

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (let i = 0; i < openers.length; i += 1) {
    const seedA = order[i * 2];
    const seedB = order[i * 2 + 1];
    updates.push(
      prisma.tournamentMatch.update({
        where: { id: openers[i].id },
        data: {
          teamAId: qualified[seedA - 1] ?? null,
          teamBId: qualified[seedB - 1] ?? null,
        },
      }),
    );
  }

  await prisma.$transaction(updates);
}

/** پس از ثبت نتیجه‌ی یک مسابقه‌ی حذفی، برنده به مرحله‌ی بعد منتقل می‌شود */
export async function advanceWinner(matchId: string) {
  const match = await prisma.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!match?.winnerTeamId || !match.nextMatchId) return;

  await prisma.tournamentMatch.update({
    where: { id: match.nextMatchId },
    data:
      match.nextMatchSlot === 1
        ? { teamAId: match.winnerTeamId }
        : { teamBId: match.winnerTeamId },
  });
}
