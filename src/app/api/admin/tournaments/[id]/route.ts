import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { notify, notifyMany } from '@/lib/notifications';
import { AppError, handleApiError, ok } from '@/lib/api';
import { tournamentSchema } from '@/lib/validation';
import { tomanToRial } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';
import { buildTournamentData } from '../helpers';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = tournamentSchema.parse(body);

    const before = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: { include: { members: true } } },
    });
    if (!before) throw new AppError('تورنومنت یافت نشد.', 404);

    if (input.maxTeams < before.teams.length) {
      throw new AppError(
        `ظرفیت نمی‌تواند کمتر از ${toFaDigits(before.teams.length)} تیم ثبت‌نام‌شده باشد.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id },
        data: { ...buildTournamentData(input), entryFee: tomanToRial(input.entryFeeToman) },
      });

      await tx.tournamentCourt.deleteMany({ where: { tournamentId: id } });
      if (input.courtIds.length) {
        await tx.tournamentCourt.createMany({
          data: input.courtIds.map((courtId) => ({ tournamentId: id, courtId })),
          skipDuplicates: true,
        });
      }

      if (input.levelRule) {
        await tx.tournamentLevelRule.upsert({
          where: { tournamentId: id },
          create: {
            tournamentId: id,
            type: input.levelRule.type,
            slot1Levels: input.levelRule.slot1Levels,
            slot2Levels: input.levelRule.slot2Levels,
            combinations: input.levelRule.combinations,
            orderInsensitive: input.levelRule.orderInsensitive,
            description: input.levelRule.description ?? null,
          },
          update: {
            type: input.levelRule.type,
            slot1Levels: input.levelRule.slot1Levels,
            slot2Levels: input.levelRule.slot2Levels,
            combinations: input.levelRule.combinations,
            orderInsensitive: input.levelRule.orderInsensitive,
            description: input.levelRule.description ?? null,
          },
        });
      }

      await tx.tournamentPointsRule.deleteMany({ where: { tournamentId: id } });
      if (input.pointsRules.length) {
        await tx.tournamentPointsRule.createMany({
          data: input.pointsRules.map((r) => ({
            tournamentId: id,
            rank: r.rank,
            pointsPerPlayer: r.pointsPerPlayer,
            label: r.label ?? null,
          })),
          skipDuplicates: true,
        });
      }
    }, { timeout: 20_000 });

    /* وقتی ثبت‌نام باز می‌شود، همه‌ی بازیکنان فعال خبردار می‌شوند — نه فقط
       تیم‌های ثبت‌نام‌کرده، چون هنوز کسی ثبت‌نام نکرده است. */
    if (input.status === 'REGISTRATION_OPEN' && before.status !== 'REGISTRATION_OPEN') {
      const players = await prisma.user.findMany({
        where: { role: 'PLAYER', status: 'ACTIVE' },
        select: { id: true },
      });
      await notifyMany(
        players.map((p) => ({
          userId: p.id,
          type: 'TOURNAMENT_ANNOUNCED' as const,
          title: 'تورنومنت جدید 🏆',
          body: `ثبت‌نام تورنومنت «${input.name}» باز شد. جای خود را رزرو کنید.`,
          actionUrl: `/tournaments/${id}`,
        })),
      );
    }

    // اطلاع‌رسانی شروع تورنومنت به بازیکنان
    if (input.status === 'ONGOING' && before.status !== 'ONGOING') {
      const userIds = before.teams.flatMap((t) => t.members.map((m) => m.userId));
      await Promise.all(
        userIds.map((userId) =>
          notify({
            userId,
            type: 'TOURNAMENT_STARTED',
            title: 'تورنومنت آغاز شد 🏆',
            body: `تورنومنت «${input.name}» شروع شد. برنامه‌ی مسابقات را ببینید.`,
            actionUrl: `/tournaments/${id}`,
          }),
        ),
      );
    }

    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
    if (teamCount > 0) {
      await prisma.tournament.update({ where: { id }, data: { status: 'CANCELLED' } });
      return ok({ deleted: false, cancelled: true });
    }

    await prisma.tournament.delete({ where: { id } });
    return ok({ deleted: true, cancelled: false });
  } catch (error) {
    return handleApiError(error);
  }
}
