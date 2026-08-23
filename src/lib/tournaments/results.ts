import 'server-only';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/api';
import { mutatePoints } from '@/lib/points';
import { notify } from '@/lib/notifications';
import { rankLabel } from '@/lib/constants';
import { compareRows } from './standings';

/**
 * تعیین رتبه‌ی نهایی تیم‌ها.
 * لیگ: بر اساس جدول نهایی.
 * گروهی+حذفی: بر اساس نتایج مرحله‌ی حذفی و سپس جدول گروه‌ها.
 */
export async function computeFinalRanking(tournamentId: string): Promise<string[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      standings: true,
      matches: { orderBy: [{ round: 'desc' }, { slotInRound: 'asc' }] },
      teams: { where: { isActive: true } },
    },
  });
  if (!tournament) throw new AppError('تورنومنت یافت نشد.', 404);

  if (tournament.type === 'LEAGUE') {
    return [...tournament.standings]
      .sort(compareRows)
      .map((s) => s.teamId);
  }

  const ordered: string[] = [];
  const push = (id: string | null | undefined) => {
    if (id && !ordered.includes(id)) ordered.push(id);
  };

  const final = tournament.matches.find((m) => m.stage === 'FINAL' && m.status === 'COMPLETED');
  if (final?.winnerTeamId) {
    push(final.winnerTeamId);
    push(final.teamAId === final.winnerTeamId ? final.teamBId : final.teamAId);
  }

  const third = tournament.matches.find((m) => m.stage === 'THIRD_PLACE' && m.status === 'COMPLETED');
  if (third?.winnerTeamId) {
    push(third.winnerTeamId);
    push(third.teamAId === third.winnerTeamId ? third.teamBId : third.teamAId);
  } else {
    // بازندگان نیمه‌نهایی
    for (const m of tournament.matches.filter((x) => x.stage === 'SEMI_FINAL')) {
      if (m.winnerTeamId) push(m.teamAId === m.winnerTeamId ? m.teamBId : m.teamAId);
    }
  }

  // بقیه بر اساس مرحله‌ی حذف‌شدن و سپس جدول گروهی
  const stageWeight: Record<string, number> = {
    QUARTER_FINAL: 5, ROUND_OF_16: 9, ROUND_OF_32: 17,
  };
  const eliminated: { teamId: string; weight: number }[] = [];
  for (const m of tournament.matches) {
    if (m.status !== 'COMPLETED' || !m.winnerTeamId) continue;
    const weight = stageWeight[m.stage];
    if (!weight) continue;
    const loser = m.teamAId === m.winnerTeamId ? m.teamBId : m.teamAId;
    if (loser && !ordered.includes(loser)) eliminated.push({ teamId: loser, weight });
  }
  eliminated.sort((a, b) => a.weight - b.weight);
  eliminated.forEach((e) => push(e.teamId));

  const remaining = [...tournament.standings].sort(compareRows).map((s) => s.teamId);
  remaining.forEach(push);
  tournament.teams.forEach((t) => push(t.id));

  return ordered;
}

/**
 * پایان تورنومنت: ثبت رتبه‌ها و اعطای خودکار امتیاز به بازیکنان تیم‌های برتر
 * بر اساس قوانین امتیازی که ادمین تعریف کرده است.
 * فرآیند idempotent است — اجرای دوباره امتیاز تکراری نمی‌دهد.
 */
export async function finalizeTournament(tournamentId: string, performedById?: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      pointsRules: { orderBy: { rank: 'asc' } },
      teams: { where: { isActive: true }, include: { members: true } },
    },
  });
  if (!tournament) throw new AppError('تورنومنت یافت نشد.', 404);
  if (tournament.status === 'CANCELLED') throw new AppError('تورنومنت لغو شده است.');

  const ranking = await computeFinalRanking(tournamentId);
  const teamById = new Map(tournament.teams.map((t) => [t.id, t]));
  const awarded: { userId: string; points: number; rank: number }[] = [];

  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < ranking.length; i += 1) {
        const teamId = ranking[i];
        const finalRank = i + 1;
        const team = teamById.get(teamId);
        if (!team) continue;

        const rule = tournament.pointsRules.find((r) => r.rank === finalRank);
        const pointsPerPlayer = rule?.pointsPerPlayer ?? 0;

        await tx.tournamentResult.upsert({
          where: { teamId },
          create: {
            tournamentId,
            teamId,
            finalRank,
            pointsAwarded: pointsPerPlayer,
            pointsAwardedAt: pointsPerPlayer > 0 ? new Date() : null,
          },
          update: {
            finalRank,
            pointsAwarded: pointsPerPlayer,
            pointsAwardedAt: pointsPerPlayer > 0 ? new Date() : null,
          },
        });

        if (pointsPerPlayer <= 0) continue;

        for (const member of team.members) {
          await mutatePoints(tx, {
            userId: member.userId,
            amount: pointsPerPlayer,
            type: 'TOURNAMENT_AWARD',
            description: `${rankLabel(finalRank)} تورنومنت ${tournament.name}`,
            // کلید یکتا: اجرای دوباره امتیاز تکراری اضافه نمی‌کند
            referenceKey: `tournament:${tournamentId}:team:${teamId}:user:${member.userId}`,
            tournamentId,
            performedById,
          });
          awarded.push({ userId: member.userId, points: pointsPerPlayer, rank: finalRank });
        }
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });
    },
    { timeout: 60_000 },
  );

  await Promise.all(
    awarded.map((a) =>
      notify({
        userId: a.userId,
        type: 'POINTS_AWARDED',
        title: `${a.points} امتیاز دریافت کردید ⭐`,
        body: `${rankLabel(a.rank)} تورنومنت «${tournament.name}»`,
        actionUrl: '/profile',
        data: { tournamentId, points: a.points, rank: a.rank },
      }),
    ),
  );

  return { ranking, awardedCount: awarded.length };
}
