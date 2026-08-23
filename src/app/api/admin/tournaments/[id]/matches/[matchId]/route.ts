import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { advanceWinner, recomputeStandings } from '@/lib/tournaments/standings';
import { AppError, handleApiError, ok } from '@/lib/api';
import { matchResultSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/** ثبت نتیجه‌ی یک مسابقه — جدول و براکت به‌صورت خودکار به‌روزرسانی می‌شوند */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; matchId: string }> },
) {
  try {
    await requireAdmin();
    const { id, matchId } = await ctx.params;
    const body = await req.json();
    const input = matchResultSchema.parse(body);

    const match = await prisma.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!match || match.tournamentId !== id) throw new AppError('مسابقه یافت نشد.', 404);
    if (!match.teamAId || !match.teamBId) {
      throw new AppError('تیم‌های این مسابقه هنوز مشخص نشده‌اند.', 409);
    }

    const setsA = input.sets.filter((s) => s.a > s.b).length;
    const setsB = input.sets.filter((s) => s.b > s.a).length;

    let winnerTeamId = input.winnerTeamId ?? null;
    if (!winnerTeamId && input.status === 'COMPLETED') {
      if (setsA > setsB) winnerTeamId = match.teamAId;
      else if (setsB > setsA) winnerTeamId = match.teamBId;
    }
    if (winnerTeamId && winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) {
      throw new AppError('تیم برنده باید یکی از دو تیم این مسابقه باشد.');
    }

    await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: input.status,
        scoreA: setsA,
        scoreB: setsB,
        setScores: input.sets,
        winnerTeamId,
        notes: input.notes,
      },
    });

    await recomputeStandings(id);
    await advanceWinner(matchId);

    return ok({ matchId, setsA, setsB, winnerTeamId });
  } catch (error) {
    return handleApiError(error);
  }
}
