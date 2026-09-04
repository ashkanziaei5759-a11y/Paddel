import 'server-only';
import type { PlayerLevel, Prisma } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';
import { mutateWallet } from './wallet';
import { notify } from './notifications';
import { LEVEL_LABEL } from './constants';
import { formatToman, generateBookingCode } from './utils';
import { formatDateTime, toFaDigits } from './datetime';

/** تا این اندازه پیش از شروع بازی، خروج و بازگشت سهم مجاز است */
export const LEAVE_CUTOFF_MINUTES = 120;

const MIN_CAPACITY = 2;
const MAX_CAPACITY = 8;

/**
 * پول چطور جابه‌جا می‌شود
 * ─────────────────────
 * میزبان هنگام رزرو، کل هزینه‌ی زمین را از کیف پولش پرداخته است.
 * هر بازیکنی که می‌پیوندد سهم خودش را می‌پردازد، ولی این مبلغ مستقیم به کیف پول
 * میزبان نمی‌رود؛ روی خودِ بازی نگه داشته می‌شود (escrowBalance). این کار دو
 * مسئله را حل می‌کند:
 *
 *   · اگر بازیکنی خارج شود، سهمش از همان‌جا برمی‌گردد و لازم نیست امیدوار باشیم
 *     میزبان هنوز پول را خرج نکرده باشد.
 *   · اگر بازی لغو شود، همه‌ی سهم‌ها بی‌کم‌وکاست قابل بازگشت‌اند.
 *
 * سهم‌ها فقط هنگام تسویه (پس از برگزاری) یک‌جا به میزبان پرداخت می‌شوند.
 */

export interface CreateMatchInput {
  userId: string;
  bookingId: string;
  capacity: number;
  levelPolicy: 'ANY' | 'RANGE';
  allowedLevels?: PlayerLevel[];
  notes?: string;
}

export async function createOpenMatch(input: CreateMatchInput) {
  if (input.capacity < MIN_CAPACITY || input.capacity > MAX_CAPACITY) {
    throw new AppError(
      `ظرفیت بازی باید بین ${toFaDigits(MIN_CAPACITY)} تا ${toFaDigits(MAX_CAPACITY)} نفر باشد.`,
    );
  }
  if (input.levelPolicy === 'RANGE' && !input.allowedLevels?.length) {
    throw new AppError('حداقل یک سطح مجاز انتخاب کنید.');
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: { court: { select: { name: true } }, openMatch: { select: { id: true } } },
    });

    if (!booking) throw new AppError('رزرو یافت نشد.', 404);
    if (booking.userId !== input.userId) throw new AppError('این رزرو متعلق به شما نیست.', 403);
    if (booking.status !== 'CONFIRMED') throw new AppError('این رزرو فعال نیست.', 409);
    if (booking.openMatch) throw new AppError('برای این رزرو از قبل یک بازی باز ساخته‌اید.', 409);
    if (booking.startsAt.getTime() <= Date.now()) {
      throw new AppError('زمان این رزرو گذشته است.', 409);
    }

    /* سهم هر نفر رو به بالا گرد می‌شود تا مجموع سهم‌ها کمتر از هزینه‌ی زمین نشود */
    const capacity = BigInt(input.capacity);
    const sharePerPlayer = (booking.totalPrice + capacity - 1n) / capacity;

    const match = await tx.openMatch.create({
      data: {
        code: generateBookingCode('MT'),
        bookingId: booking.id,
        hostId: input.userId,
        capacity: input.capacity,
        sharePerPlayer,
        levelPolicy: input.levelPolicy,
        allowedLevels: input.levelPolicy === 'RANGE' ? (input.allowedLevels ?? []) : [],
        notes: input.notes?.trim() || null,
        players: { create: { userId: input.userId, isHost: true, paidAmount: 0n } },
      },
    });

    return { matchId: match.id, code: match.code, sharePerPlayer };
  });
}

export interface JoinLeaveInput {
  userId: string;
  matchId: string;
}

export async function joinMatch(input: JoinLeaveInput) {
  return prisma.$transaction(
    async (tx) => {
      await lockMatch(tx, input.matchId);

      const full = await tx.openMatch.findUniqueOrThrow({
        where: { id: input.matchId },
        include: {
          booking: { include: { court: { select: { name: true } } } },
          players: { select: { userId: true } },
        },
      });

      /* عضویت پیش از ظرفیت بررسی می‌شود: برای کسی که از قبل در بازی است،
         «ظرفیت تکمیل شده» پیام گمراه‌کننده‌ای است. */
      if (full.players.some((p) => p.userId === input.userId)) {
        throw new AppError('شما از قبل در این بازی هستید.', 409);
      }
      if (full.status === 'CANCELLED' || full.status === 'COMPLETED') {
        throw new AppError('این بازی دیگر پذیرای بازیکن جدید نیست.', 409);
      }
      if (full.booking.startsAt.getTime() <= Date.now()) {
        throw new AppError('زمان این بازی گذشته است.', 409);
      }
      if (full.status === 'FULL' || full.players.length >= full.capacity) {
        throw new AppError('ظرفیت این بازی تکمیل شده است.', 409);
      }

      await assertLevelAllowed(tx, input.userId, full.levelPolicy, full.allowedLevels);

      await mutateWallet(tx, {
        userId: input.userId,
        amount: -full.sharePerPlayer,
        type: 'MATCH_JOIN',
        description: `سهم بازی ${full.booking.court.name} — ${formatDateTime(full.booking.startsAt)}`,
        referenceKey: `match:${full.id}:join:${input.userId}`,
        bookingId: full.bookingId,
        metadata: { openMatchId: full.id },
      });

      /* جای بازیکن از همین لحظه رزرو و سهمش گرفته می‌شود، حتی وقتی منتظر
         تأیید میزبان است — وگرنه دو نفر می‌توانستند روی یک جای خالی منتظر
         بمانند و ظرفیت بیش از اندازه فروخته شود. رد شدن، سهم را برمی‌گرداند. */
      await tx.openMatchPlayer.create({
        data: {
          matchId: full.id,
          userId: input.userId,
          paidAmount: full.sharePerPlayer,
          status: full.requiresApproval ? 'PENDING' : 'APPROVED',
        },
      });

      const seatsTaken = full.players.length + 1;
      const nowFull = seatsTaken >= full.capacity;

      await tx.openMatch.update({
        where: { id: full.id },
        data: {
          escrowBalance: { increment: full.sharePerPlayer },
          status: nowFull ? 'FULL' : 'OPEN',
        },
      });

      /* تراکنش MATCH_JOIN را به بازی وصل می‌کنیم تا در تاریخچه قابل ردیابی باشد */
      await tx.walletTransaction.updateMany({
        where: { referenceKey: `match:${full.id}:join:${input.userId}` },
        data: { openMatchId: full.id },
      });

      return {
        match: full,
        seatsTaken,
        nowFull,
        share: full.sharePerPlayer,
      };
    },
    { isolationLevel: 'ReadCommitted' },
  ).then(async (result) => {
    const player = await prisma.profile.findUnique({
      where: { userId: input.userId },
      select: { firstName: true, lastName: true },
    });
    const name = player ? `${player.firstName} ${player.lastName}` : 'یک بازیکن';
    const remaining = result.match.capacity - result.seatsTaken;

    if (result.match.requiresApproval) {
      await notify({
        userId: result.match.hostId,
        type: 'MATCH_JOIN_REQUEST',
        title: 'درخواست پیوستن به بازی شما',
        body: `${name} می‌خواهد به بازی ${result.match.booking.court.name} بپیوندد. تأیید یا رد کنید.`,
        actionUrl: `/matches/${result.match.id}`,
      });
    } else {
      await notify({
        userId: result.match.hostId,
        type: 'MATCH_PLAYER_JOINED',
        title: result.nowFull ? 'بازی شما تکمیل شد 🎉' : 'یک بازیکن به بازی شما پیوست',
        body: result.nowFull
          ? `${name} آخرین جای خالی را گرفت. بازی ${result.match.booking.court.name} آماده است.`
          : `${name} به بازی شما پیوست. ${toFaDigits(remaining)} جای خالی مانده است.`,
        actionUrl: `/matches/${result.match.id}`,
      });
    }

    return {
      seatsTaken: result.seatsTaken,
      nowFull: result.nowFull,
      share: result.share,
      pending: result.match.requiresApproval,
    };
  });
}

export interface HostDecisionInput {
  matchId: string;
  /** میزبان — تنها کسی که اجازه‌ی تصمیم دارد */
  hostId: string;
  /** بازیکنی که درخواستش بررسی می‌شود */
  playerUserId: string;
}

/**
 * تأیید بازیکنِ در انتظار توسط میزبان.
 *
 * پول از قبل هنگام پیوستن گرفته شده است، پس اینجا فقط وضعیت عوض می‌شود.
 * عملیات idempotent است: تأیید دوباره خطا نمی‌دهد و پول را جابه‌جا نمی‌کند.
 */
export async function approveMatchPlayer(input: HostDecisionInput) {
  const result = await prisma.$transaction(async (tx) => {
    await lockMatch(tx, input.matchId);

    const match = await tx.openMatch.findUniqueOrThrow({
      where: { id: input.matchId },
      include: {
        booking: { include: { court: { select: { name: true } } } },
        players: true,
      },
    });

    if (match.hostId !== input.hostId) {
      throw new AppError('فقط میزبان بازی می‌تواند بازیکن‌ها را تأیید کند.', 403);
    }
    if (match.status === 'CANCELLED' || match.status === 'COMPLETED') {
      throw new AppError('این بازی بسته شده است.', 409);
    }

    const seat = match.players.find((p) => p.userId === input.playerUserId);
    if (!seat) throw new AppError('این بازیکن در بازی شما نیست.', 404);
    if (seat.status === 'APPROVED') {
      return { match, alreadyDone: true };
    }

    await tx.openMatchPlayer.update({ where: { id: seat.id }, data: { status: 'APPROVED' } });
    return { match, alreadyDone: false };
  });

  if (!result.alreadyDone) {
    await notify({
      userId: input.playerUserId,
      type: 'MATCH_JOIN_APPROVED',
      title: 'درخواست شما تأیید شد ✅',
      body: `میزبان شما را در بازی ${result.match.booking.court.name} پذیرفت.`,
      actionUrl: `/matches/${result.match.id}`,
    });
  }

  return { ok: true };
}

/**
 * رد کردن بازیکنِ در انتظار.
 *
 * سهمی که هنگام پیوستن گرفته شده بود کامل برمی‌گردد و جای خالی آزاد می‌شود.
 * referenceKey همان کلید خروج است، پس اگر درخواست دو بار برسد پول دو بار
 * برنمی‌گردد.
 */
export async function rejectMatchPlayer(input: HostDecisionInput) {
  const result = await prisma.$transaction(async (tx) => {
    await lockMatch(tx, input.matchId);

    const match = await tx.openMatch.findUniqueOrThrow({
      where: { id: input.matchId },
      include: {
        booking: { include: { court: { select: { name: true } } } },
        players: true,
      },
    });

    if (match.hostId !== input.hostId) {
      throw new AppError('فقط میزبان بازی می‌تواند بازیکن‌ها را رد کند.', 403);
    }
    if (match.status === 'CANCELLED' || match.status === 'COMPLETED') {
      throw new AppError('این بازی بسته شده است.', 409);
    }

    const seat = match.players.find((p) => p.userId === input.playerUserId);
    if (!seat) throw new AppError('این بازیکن در بازی شما نیست.', 404);
    if (seat.isHost) throw new AppError('میزبان را نمی‌توان رد کرد.', 409);
    if (seat.status === 'APPROVED') {
      throw new AppError('این بازیکن قبلاً تأیید شده است.', 409);
    }

    await mutateWallet(tx, {
      userId: input.playerUserId,
      amount: seat.paidAmount,
      type: 'MATCH_LEAVE_REFUND',
      description: `بازگشت سهم بازی ${match.booking.court.name}`,
      referenceKey: `match:${match.id}:leave:${input.playerUserId}`,
      bookingId: match.bookingId,
      metadata: { openMatchId: match.id },
    });

    await tx.openMatchPlayer.delete({ where: { id: seat.id } });

    await tx.openMatch.update({
      where: { id: match.id },
      data: {
        escrowBalance: { decrement: seat.paidAmount },
        /* جای خالی دوباره باز شد */
        status: 'OPEN',
      },
    });

    return { match, refunded: seat.paidAmount };
  });

  await notify({
    userId: input.playerUserId,
    type: 'MATCH_JOIN_REJECTED',
    title: 'درخواست شما پذیرفته نشد',
    body: `میزبان بازی ${result.match.booking.court.name} درخواست شما را رد کرد. سهم شما به کیف پول بازگشت.`,
    actionUrl: '/matches',
  });

  return { ok: true, refunded: result.refunded };
}

export async function leaveMatch(input: JoinLeaveInput) {
  return prisma.$transaction(async (tx) => {
    const match = await lockMatch(tx, input.matchId);

    if (match.status === 'CANCELLED' || match.status === 'COMPLETED') {
      throw new AppError('این بازی بسته شده است.', 409);
    }

    const full = await tx.openMatch.findUniqueOrThrow({
      where: { id: input.matchId },
      include: {
        booking: { include: { court: { select: { name: true } } } },
        players: true,
      },
    });

    const seat = full.players.find((p) => p.userId === input.userId);
    if (!seat) throw new AppError('شما در این بازی نیستید.', 404);
    if (seat.isHost) {
      throw new AppError('میزبان نمی‌تواند خارج شود؛ برای لغو، رزرو را لغو کنید.', 409);
    }

    const minutesToStart = Math.floor((full.booking.startsAt.getTime() - Date.now()) / 60_000);
    if (minutesToStart < LEAVE_CUTOFF_MINUTES) {
      throw new AppError(
        `تا ${toFaDigits(LEAVE_CUTOFF_MINUTES / 60)} ساعت پیش از شروع بازی می‌توانستید خارج شوید.`,
        409,
      );
    }

    await mutateWallet(tx, {
      userId: input.userId,
      amount: seat.paidAmount,
      type: 'MATCH_LEAVE_REFUND',
      description: `بازگشت سهم بازی ${full.booking.court.name}`,
      referenceKey: `match:${full.id}:leave:${input.userId}`,
      bookingId: full.bookingId,
      metadata: { openMatchId: full.id },
    });

    await tx.openMatchPlayer.delete({ where: { id: seat.id } });
    await tx.openMatch.update({
      where: { id: full.id },
      data: { escrowBalance: { decrement: seat.paidAmount }, status: 'OPEN' },
    });
    await tx.walletTransaction.updateMany({
      where: { referenceKey: `match:${full.id}:leave:${input.userId}` },
      data: { openMatchId: full.id },
    });

    return { refunded: seat.paidAmount, hostId: full.hostId, courtName: full.booking.court.name };
  }).then(async (result) => {
    await notify({
      userId: result.hostId,
      type: 'MATCH_PLAYER_LEFT',
      title: 'یک بازیکن از بازی شما خارج شد',
      body: `یک جای خالی در بازی ${result.courtName} باز شد.`,
      actionUrl: `/matches/${input.matchId}`,
    });
    return { refunded: result.refunded };
  });
}

/**
 * تسویه‌ی بازی — سهم‌های جمع‌شده یک‌جا به میزبان پرداخت می‌شود.
 * پس از برگزاری بازی صدا زده می‌شود (توسط میزبان یا مدیر).
 */
export async function settleMatch(matchId: string, performedBy?: string) {
  return prisma.$transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);

    if (match.status === 'COMPLETED') throw new AppError('این بازی قبلاً تسویه شده است.', 409);
    if (match.status === 'CANCELLED') throw new AppError('این بازی لغو شده است.', 409);

    const full = await tx.openMatch.findUniqueOrThrow({
      where: { id: matchId },
      include: { booking: { include: { court: { select: { name: true } } } } },
    });

    if (full.booking.endsAt.getTime() > Date.now()) {
      throw new AppError('بازی هنوز تمام نشده است.', 409);
    }

    if (full.escrowBalance > 0n) {
      await mutateWallet(tx, {
        userId: full.hostId,
        amount: full.escrowBalance,
        type: 'MATCH_PAYOUT',
        description: `سهم بازیکنان بازی ${full.booking.court.name}`,
        referenceKey: `match:${full.id}:payout`,
        bookingId: full.bookingId,
        performedBy,
        metadata: { openMatchId: full.id },
      });
      await tx.walletTransaction.updateMany({
        where: { referenceKey: `match:${full.id}:payout` },
        data: { openMatchId: full.id },
      });
    }

    await tx.openMatch.update({
      where: { id: full.id },
      data: { escrowBalance: 0n, status: 'COMPLETED', settledAt: new Date() },
    });

    return { paidOut: full.escrowBalance };
  });
}

/**
 * لغو بازی — سهم هر بازیکن بی‌کم‌وکاست برمی‌گردد.
 * هنگام لغو رزروِ زیربنایی صدا زده می‌شود.
 */
export async function cancelOpenMatch(
  tx: Prisma.TransactionClient,
  matchId: string,
  reason: string,
) {
  const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status FROM "open_matches" WHERE id = ${matchId} FOR UPDATE
  `;
  if (locked.length === 0) return { refunded: 0n, players: 0 };
  if (locked[0].status === 'CANCELLED' || locked[0].status === 'COMPLETED') {
    return { refunded: 0n, players: 0 };
  }

  const full = await tx.openMatch.findUniqueOrThrow({
    where: { id: matchId },
    include: { players: true, booking: { include: { court: { select: { name: true } } } } },
  });

  let refunded = 0n;
  const guests = full.players.filter((p) => !p.isHost && p.paidAmount > 0n);

  for (const seat of guests) {
    await mutateWallet(tx, {
      userId: seat.userId,
      amount: seat.paidAmount,
      type: 'MATCH_LEAVE_REFUND',
      description: `بازگشت سهم بازی لغو‌شده‌ی ${full.booking.court.name}`,
      referenceKey: `match:${full.id}:cancel:${seat.userId}`,
      bookingId: full.bookingId,
      metadata: { openMatchId: full.id, reason },
    });
    await tx.walletTransaction.updateMany({
      where: { referenceKey: `match:${full.id}:cancel:${seat.userId}` },
      data: { openMatchId: full.id },
    });
    refunded += seat.paidAmount;
  }

  await tx.openMatch.update({
    where: { id: full.id },
    data: { escrowBalance: 0n, status: 'CANCELLED', cancelledAt: new Date() },
  });

  return { refunded, players: guests.length, guests: guests.map((g) => g.userId) };
}

// ---------------------------------------------------------------------------
// کمکی‌ها
// ---------------------------------------------------------------------------

/** ردیف بازی را تا پایان تراکنش قفل می‌کند تا دو نفر هم‌زمان آخرین جا را نگیرند */
async function lockMatch(tx: Prisma.TransactionClient, matchId: string) {
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status FROM "open_matches" WHERE id = ${matchId} FOR UPDATE
  `;
  if (rows.length === 0) throw new AppError('بازی یافت نشد.', 404);
  return rows[0];
}

async function assertLevelAllowed(
  tx: Prisma.TransactionClient,
  userId: string,
  policy: 'ANY' | 'RANGE',
  allowed: PlayerLevel[],
) {
  if (policy === 'ANY') return;

  const profile = await tx.profile.findUnique({ where: { userId }, select: { level: true } });
  if (!profile) throw new AppError('پروفایل شما کامل نیست.', 409);

  if (!allowed.includes(profile.level)) {
    throw new AppError(
      `این بازی برای سطح ${allowed.map((l) => LEVEL_LABEL[l]).join('، ')} باز است و سطح شما ${LEVEL_LABEL[profile.level]} است.`,
      409,
      'LEVEL_NOT_ALLOWED',
    );
  }
}

/** خلاصه‌ای که به کاربر نشان داده می‌شود */
export function describeShare(share: bigint, capacity: number) {
  return `${formatToman(share)} برای هر نفر · ${toFaDigits(capacity)} نفره`;
}
