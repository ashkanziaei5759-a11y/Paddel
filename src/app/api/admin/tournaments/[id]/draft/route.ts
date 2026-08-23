import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { currentPicker, makePick } from '@/lib/tournaments/draft';
import { notify } from '@/lib/notifications';
import { AppError, handleApiError, ok } from '@/lib/api';
import { draftPickSchema, draftSetupSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const draft = await prisma.tournamentDraft.findUnique({
      where: { tournamentId: id },
      include: {
        picks: {
          orderBy: { pickNumber: 'asc' },
          include: { player: { include: { profile: true } }, team: true },
        },
      },
    });
    if (!draft) return ok({ draft: null, turn: null });

    return ok({
      draft,
      turn: currentPicker(draft.pickOrder, draft.currentPickIndex, draft.snakeOrder),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** تعریف یا به‌روزرسانی ترتیب انتخاب لیدرها */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = draftSetupSchema.parse(body);

    const teams = await prisma.tournamentTeam.findMany({
      where: { id: { in: input.pickOrder }, tournamentId: id },
      select: { id: true },
    });
    if (teams.length !== input.pickOrder.length) {
      throw new AppError('برخی از تیم‌های انتخاب‌شده در این تورنومنت وجود ندارند.', 400);
    }

    const draft = await prisma.tournamentDraft.upsert({
      where: { tournamentId: id },
      create: {
        tournamentId: id,
        pickOrder: input.pickOrder,
        snakeOrder: input.snakeOrder,
        isActive: input.isActive,
        startedAt: input.isActive ? new Date() : null,
      },
      update: {
        pickOrder: input.pickOrder,
        snakeOrder: input.snakeOrder,
        isActive: input.isActive,
        ...(input.isActive ? { startedAt: new Date() } : {}),
      },
    });

    // اطلاع‌رسانی به لیدر نوبت جاری
    const turn = currentPicker(draft.pickOrder, draft.currentPickIndex, draft.snakeOrder);
    if (turn && draft.isActive) {
      const leader = await prisma.teamMember.findFirst({
        where: { teamId: turn.teamId, isLeader: true },
      });
      if (leader) {
        await notify({
          userId: leader.userId,
          type: 'DRAFT_YOUR_TURN',
          title: 'نوبت انتخاب شماست 👑',
          body: 'فرآیند انتخاب بازیکنان آغاز شد. بازیکن موردنظر خود را انتخاب کنید.',
          actionUrl: `/tournaments/${id}`,
        });
      }
    }

    return ok({ draft, turn });
  } catch (error) {
    return handleApiError(error);
  }
}

/** ثبت یک انتخاب توسط مدیر (به نمایندگی از لیدر) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = draftPickSchema.parse(body);

    const draft = await prisma.tournamentDraft.findUnique({ where: { tournamentId: id } });
    if (!draft) throw new AppError('فرآیند انتخاب برای این تورنومنت تعریف نشده است.', 404);

    const updated = await makePick(draft.id, input.teamId, input.playerId, admin.id);
    return ok({
      draft: updated,
      turn: currentPicker(updated.pickOrder, updated.currentPickIndex, updated.snakeOrder),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
