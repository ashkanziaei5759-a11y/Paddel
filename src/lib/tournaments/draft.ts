import 'server-only';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/api';
import { notify } from '@/lib/notifications';

/**
 * انتخاب بازیکن توسط لیدر (Leader / Captain Draft).
 * ترتیب انتخاب توسط ادمین تعیین می‌شود و در حالت مارپیچ (Snake)
 * در دورهای زوج برعکس می‌شود تا انصاف رعایت شود.
 */
export function currentPicker(
  pickOrder: string[],
  pickIndex: number,
  snake: boolean,
): { teamId: string; round: number } | null {
  if (pickOrder.length === 0) return null;
  const round = Math.floor(pickIndex / pickOrder.length) + 1;
  const posInRound = pickIndex % pickOrder.length;
  const isReverse = snake && round % 2 === 0;
  const idx = isReverse ? pickOrder.length - 1 - posInRound : posInRound;
  return { teamId: pickOrder[idx], round };
}

export async function makePick(draftId: string, teamId: string, playerId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.tournamentDraft.findUnique({
      where: { id: draftId },
      include: { tournament: true, picks: true },
    });
    if (!draft) throw new AppError('فرآیند انتخاب یافت نشد.', 404);
    if (!draft.isActive) throw new AppError('فرآیند انتخاب فعال نیست.');

    const turn = currentPicker(draft.pickOrder, draft.currentPickIndex, draft.snakeOrder);
    if (!turn) throw new AppError('ترتیب انتخاب تعریف نشده است.');
    if (turn.teamId !== teamId) throw new AppError('نوبت انتخاب شما نیست.', 403);

    const team = await tx.tournamentTeam.findUnique({
      where: { id: teamId },
      include: { members: true },
    });
    if (!team) throw new AppError('تیم یافت نشد.', 404);

    const actorIsLeader = team.members.some((m) => m.userId === actorId && m.isLeader);
    const actorIsAdmin = (await tx.user.findUnique({ where: { id: actorId } }))?.role === 'ADMIN';
    if (!actorIsLeader && !actorIsAdmin) {
      throw new AppError('فقط لیدر تیم می‌تواند بازیکن انتخاب کند.', 403);
    }

    const alreadyPicked = await tx.draftPick.findFirst({ where: { draftId, playerId } });
    if (alreadyPicked) throw new AppError('این بازیکن قبلاً انتخاب شده است.', 409);

    const usedSlots = team.members.map((m) => m.slot);
    const slot = [1, 2].find((s) => !usedSlots.includes(s));
    if (!slot) throw new AppError('ظرفیت این تیم تکمیل است.', 409);

    const profile = await tx.profile.findUnique({ where: { userId: playerId } });

    await tx.teamMember.create({
      data: { teamId, userId: playerId, slot, levelAtRegistration: profile?.level },
    });

    await tx.draftPick.create({
      data: {
        draftId,
        teamId,
        playerId,
        round: turn.round,
        pickNumber: draft.currentPickIndex + 1,
      },
    });

    const updated = await tx.tournamentDraft.update({
      where: { id: draftId },
      data: { currentPickIndex: { increment: 1 }, currentRound: turn.round },
    });

    return { draft: updated, tournamentId: draft.tournamentId, playerId };
  }).then(async (result) => {
    await notify({
      userId: result.playerId,
      type: 'DRAFT_YOUR_TURN',
      title: 'شما انتخاب شدید 👑',
      body: 'یکی از لیدرها شما را به تیم خود اضافه کرد.',
      actionUrl: `/tournaments/${result.tournamentId}`,
    });
    return result.draft;
  });
}
