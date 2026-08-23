import 'server-only';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/api';
import { mutateWallet } from '@/lib/wallet';
import { checkLevelRule, describeRule } from './level-rules';
import { notify } from '@/lib/notifications';
import { formatToman } from '@/lib/utils';

/** پیام‌های خطا برای هر یک از دو طرف — با صرف فعل درست فارسی */
const AVAILABILITY_MESSAGES = {
  self: {
    alreadyRegistered: 'شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید.',
    openRequest: 'شما یک درخواست پارتنری باز دارید و باید ابتدا آن را تعیین تکلیف کنید.',
  },
  other: {
    alreadyRegistered: 'این بازیکن قبلاً در این تورنومنت ثبت‌نام کرده است.',
    openRequest: 'این بازیکن یک درخواست پارتنری باز دارد و باید ابتدا آن را تعیین تکلیف کند.',
  },
} as const;

/** بررسی اینکه بازیکن هنوز در تورنومنت تیم ندارد و درخواست باز هم ندارد */
async function assertAvailable(
  tournamentId: string,
  userId: string,
  who: keyof typeof AVAILABILITY_MESSAGES,
) {
  const messages = AVAILABILITY_MESSAGES[who];

  const existingTeam = await prisma.teamMember.findFirst({
    where: { userId, team: { tournamentId, isActive: true } },
  });
  if (existingTeam) throw new AppError(messages.alreadyRegistered, 409);

  const openRequest = await prisma.partnerRequest.findFirst({
    where: {
      tournamentId,
      status: 'PENDING',
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
  });
  if (openRequest) throw new AppError(messages.openRequest, 409);
}

export interface SendPartnerRequestInput {
  tournamentId: string;
  senderId: string;
  receiverUsername: string;
  message?: string;
}

/** ارسال درخواست پارتنری — قوانین سطح پیش از ارسال بررسی می‌شوند */
export async function sendPartnerRequest(input: SendPartnerRequestInput) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: { levelRules: true, _count: { select: { teams: true } } },
  });
  if (!tournament) throw new AppError('تورنومنت یافت نشد.', 404);

  if (tournament.status !== 'REGISTRATION_OPEN') {
    throw new AppError('ثبت‌نام این تورنومنت باز نیست.', 409);
  }
  if (tournament.registrationClosesAt && tournament.registrationClosesAt.getTime() < Date.now()) {
    throw new AppError('مهلت ثبت‌نام به پایان رسیده است.', 409);
  }
  if (tournament._count.teams >= tournament.maxTeams) {
    throw new AppError('ظرفیت این تورنومنت تکمیل شده است.', 409);
  }
  if (tournament.partnerMode !== 'PLAYER_CHOICE') {
    throw new AppError('در این تورنومنت انتخاب پارتنر توسط بازیکنان انجام نمی‌شود.', 409);
  }

  const receiver = await prisma.user.findUnique({
    where: { username: input.receiverUsername.toLowerCase() },
    include: { profile: true },
  });
  if (!receiver || !receiver.profile) throw new AppError('بازیکنی با این نام کاربری یافت نشد.', 404);
  if (receiver.id === input.senderId) throw new AppError('نمی‌توانید خودتان را به‌عنوان پارتنر انتخاب کنید.');
  if (receiver.status !== 'ACTIVE') throw new AppError('حساب این بازیکن فعال نیست.', 409);

  const sender = await prisma.user.findUnique({
    where: { id: input.senderId },
    include: { profile: true },
  });
  if (!sender?.profile) throw new AppError('پروفایل شما یافت نشد.', 404);

  await assertAvailable(tournament.id, sender.id, 'self');
  await assertAvailable(tournament.id, receiver.id, 'other');

  // بررسی خودکار قانون سطح
  const rule = tournament.levelRules[0] ?? null;
  const check = checkLevelRule(rule, sender.profile.level, receiver.profile.level);
  if (!check.allowed) {
    throw new AppError(check.reason || describeRule(rule), 409, 'LEVEL_RULE_VIOLATION');
  }

  const request = await prisma.partnerRequest.create({
    data: {
      tournamentId: tournament.id,
      senderId: sender.id,
      receiverId: receiver.id,
      message: input.message,
      expiresAt: tournament.registrationClosesAt ?? tournament.startsAt,
    },
  });

  await notify({
    userId: receiver.id,
    type: 'PARTNER_REQUEST',
    title: 'درخواست پارتنری جدید 🤝',
    body: `${sender.profile.firstName} ${sender.profile.lastName} از شما دعوت کرده در تورنومنت «${tournament.name}» هم‌تیمی شوید.`,
    actionUrl: '/partner-requests',
    data: { requestId: request.id, tournamentId: tournament.id },
  });

  return request;
}

/**
 * پاسخ به درخواست پارتنری.
 * در صورت پذیرش، تیم ساخته می‌شود و هزینه‌ی ثبت‌نام درون یک تراکنش اتمیک کسر می‌گردد.
 */
export async function respondToPartnerRequest(
  requestId: string,
  responderId: string,
  action: 'ACCEPT' | 'REJECT',
) {
  const request = await prisma.partnerRequest.findUnique({
    where: { id: requestId },
    include: {
      tournament: { include: { levelRules: true, _count: { select: { teams: true } } } },
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  });

  if (!request) throw new AppError('درخواست یافت نشد.', 404);
  if (request.receiverId !== responderId) throw new AppError('این درخواست متعلق به شما نیست.', 403);
  if (request.status !== 'PENDING') throw new AppError('این درخواست قبلاً پاسخ داده شده است.', 409);

  if (action === 'REJECT') {
    const updated = await prisma.partnerRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });

    await notify({
      userId: request.senderId,
      type: 'PARTNER_REJECTED',
      title: 'درخواست پارتنری رد شد',
      body: `${request.receiver.profile?.firstName} ${request.receiver.profile?.lastName} درخواست شما را نپذیرفت. می‌توانید پارتنر دیگری انتخاب کنید.`,
      actionUrl: `/tournaments/${request.tournamentId}`,
    });

    return { request: updated, team: null };
  }

  const { tournament } = request;

  if (tournament.status !== 'REGISTRATION_OPEN') {
    throw new AppError('ثبت‌نام این تورنومنت دیگر باز نیست.', 409);
  }
  if (tournament._count.teams >= tournament.maxTeams) {
    throw new AppError('ظرفیت این تورنومنت تکمیل شده است.', 409);
  }

  const senderProfile = request.sender.profile;
  const receiverProfile = request.receiver.profile;
  if (!senderProfile || !receiverProfile) throw new AppError('پروفایل بازیکنان ناقص است.', 400);

  const check = checkLevelRule(tournament.levelRules[0] ?? null, senderProfile.level, receiverProfile.level);
  if (!check.allowed) {
    throw new AppError(check.reason || 'ترکیب سطح مجاز نیست.', 409, 'LEVEL_RULE_VIOLATION');
  }

  // اگر ترتیب جایگاه‌ها باید جابه‌جا شود
  const slot1UserId = check.swapped ? request.receiverId : request.senderId;
  const slot2UserId = check.swapped ? request.senderId : request.receiverId;
  const slot1Level = check.swapped ? receiverProfile.level : senderProfile.level;
  const slot2Level = check.swapped ? senderProfile.level : receiverProfile.level;

  const teamName = `${senderProfile.lastName} / ${receiverProfile.lastName}`;
  const fee = tournament.entryFee;
  const feePerPlayer = tournament.splitFeeBetweenPartners ? fee / 2n : fee;

  const result = await prisma.$transaction(
    async (tx) => {
      // بررسی دوباره‌ی ظرفیت درون تراکنش
      const teamCount = await tx.tournamentTeam.count({
        where: { tournamentId: tournament.id, isActive: true },
      });
      if (teamCount >= tournament.maxTeams) {
        throw new AppError('ظرفیت این تورنومنت همین لحظه تکمیل شد.', 409);
      }

      const team = await tx.tournamentTeam.create({
        data: {
          tournamentId: tournament.id,
          name: teamName,
          seed: teamCount + 1,
          members: {
            create: [
              { userId: slot1UserId, slot: 1, levelAtRegistration: slot1Level },
              { userId: slot2UserId, slot: 2, levelAtRegistration: slot2Level },
            ],
          },
        },
      });

      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId: tournament.id,
          createdById: request.senderId,
          teamId: team.id,
          status: 'CONFIRMED',
          feePaid: fee,
        },
      });

      if (fee > 0n) {
        if (tournament.splitFeeBetweenPartners) {
          for (const userId of [slot1UserId, slot2UserId]) {
            await mutateWallet(tx, {
              userId,
              amount: -feePerPlayer,
              type: 'TOURNAMENT_FEE',
              description: `هزینه ثبت‌نام تورنومنت ${tournament.name}`,
              referenceKey: `tournament:${tournament.id}:team:${team.id}:user:${userId}:fee`,
              registrationId: registration.id,
            });
          }
        } else {
          await mutateWallet(tx, {
            userId: request.senderId,
            amount: -fee,
            type: 'TOURNAMENT_FEE',
            description: `هزینه ثبت‌نام تورنومنت ${tournament.name}`,
            referenceKey: `tournament:${tournament.id}:team:${team.id}:fee`,
            registrationId: registration.id,
          });
        }
      }

      const updatedRequest = await tx.partnerRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED', respondedAt: new Date(), registrationId: registration.id },
      });

      return { request: updatedRequest, team };
    },
    { isolationLevel: 'ReadCommitted', timeout: 20_000 },
  );

  const feeNote = fee > 0n ? ` مبلغ ${formatToman(fee)} بابت ورودی کسر شد.` : '';

  await notify({
    userId: request.senderId,
    type: 'PARTNER_ACCEPTED',
    title: 'پارتنر شما درخواست را پذیرفت ✅',
    body: `تیم «${teamName}» در تورنومنت «${tournament.name}» ثبت شد.${feeNote}`,
    actionUrl: `/tournaments/${tournament.id}`,
  });

  await notify({
    userId: request.receiverId,
    type: 'TOURNAMENT_REGISTERED',
    title: 'ثبت‌نام شما نهایی شد 🏆',
    body: `تیم «${teamName}» در تورنومنت «${tournament.name}» ثبت شد.`,
    actionUrl: `/tournaments/${tournament.id}`,
  });

  return result;
}
