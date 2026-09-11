import 'server-only';
import type { Role } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';
import { mutateWallet } from './wallet';
import { mutatePoints } from './points';
import { cancelOpenMatch } from './matches';
import { DEFAULT_CANCELLATION_POLICIES } from './constants';
import { notify } from './notifications';
import { formatToman } from './utils';
import { formatDateTime } from './datetime';

export interface RefundQuote {
  minutesBeforeStart: number;
  penaltyPercent: number;
  penaltyAmount: bigint;
  refundAmount: bigint;
  policyName: string;
}

/**
 * محاسبه‌ی جریمه‌ی لغو بر اساس فاصله‌ی زمانی تا شروع رزرو.
 * پله‌ها از پایگاه داده خوانده می‌شوند تا ادمین بتواند آن‌ها را تغییر دهد؛
 * در نبود رکورد، پله‌های پیش‌فرض سند اعمال می‌شود.
 */
export async function quoteRefund(
  totalPrice: bigint,
  startsAt: Date,
  now = new Date(),
): Promise<RefundQuote> {
  const minutesBeforeStart = Math.floor((startsAt.getTime() - now.getTime()) / 60_000);
  const effectiveMinutes = Math.max(0, minutesBeforeStart);

  const dbPolicies = await prisma.cancellationPolicy.findMany({
    where: { isActive: true },
    orderBy: { minMinutesBefore: 'desc' },
  });

  const policies = dbPolicies.length
    ? dbPolicies.map((p) => ({
        name: p.name,
        minMinutesBefore: p.minMinutesBefore,
        maxMinutesBefore: p.maxMinutesBefore,
        penaltyPercent: p.penaltyPercent,
      }))
    : [...DEFAULT_CANCELLATION_POLICIES];

  const matched =
    policies.find(
      (p) =>
        effectiveMinutes >= p.minMinutesBefore &&
        (p.maxMinutesBefore === null || effectiveMinutes < p.maxMinutesBefore),
    ) ?? policies[policies.length - 1];

  const penaltyPercent = matched.penaltyPercent;
  const penaltyAmount = (totalPrice * BigInt(penaltyPercent)) / 100n;
  const refundAmount = totalPrice - penaltyAmount;

  return {
    minutesBeforeStart,
    penaltyPercent,
    penaltyAmount,
    refundAmount,
    policyName: matched.name,
  };
}

export interface CancelBookingInput {
  bookingId: string;
  cancelledBy: string;
  cancelledRole: Role;
  reason?: string;
  /** ادمین می‌تواند مبلغ بازگشتی را دستی تعیین کند */
  overrideRefundAmount?: bigint;
  adjustmentNote?: string;
}

/**
 * لغو رزرو + بازگشت خودکار وجه به کیف پول، درون یک تراکنش اتمیک.
 * سانس‌های رزرو آزاد می‌شوند تا دوباره قابل انتخاب باشند.
 */
export async function cancelBooking(input: CancelBookingInput) {
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: { court: true, cancellation: true, openMatch: { select: { id: true } } },
      });

      if (!booking) throw new AppError('رزرو موردنظر یافت نشد.', 404);
      if (booking.status === 'CANCELLED') throw new AppError('این رزرو قبلاً لغو شده است.', 409);
      if (booking.status === 'COMPLETED') {
        throw new AppError('رزرو برگزارشده قابل لغو نیست.', 409);
      }
      if (input.cancelledRole !== 'ADMIN') {
        if (booking.userId !== input.cancelledBy) {
          throw new AppError('شما اجازه‌ی لغو این رزرو را ندارید.', 403);
        }
        if (booking.startsAt.getTime() <= Date.now()) {
          throw new AppError('زمان این رزرو گذشته است و قابل لغو نیست.', 409);
        }
      }

      const quote = await quoteRefund(booking.totalPrice, booking.startsAt);
      const isManual = input.overrideRefundAmount !== undefined;
      const refundAmount = isManual ? input.overrideRefundAmount! : quote.refundAmount;

      if (refundAmount < 0n || refundAmount > booking.totalPrice) {
        throw new AppError('مبلغ بازگشتی نامعتبر است.');
      }
      const penaltyAmount = booking.totalPrice - refundAmount;
      const penaltyPercent =
        booking.totalPrice === 0n
          ? 0
          : Number((penaltyAmount * 100n) / booking.totalPrice);

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });

      // آزادسازی سانس‌ها تا دوباره قابل رزرو شوند
      await tx.bookingSlot.deleteMany({ where: { bookingId: booking.id } });

      await tx.bookingCancellation.create({
        data: {
          bookingId: booking.id,
          cancelledBy: input.cancelledBy,
          cancelledRole: input.cancelledRole,
          minutesBeforeStart: quote.minutesBeforeStart,
          penaltyPercent,
          penaltyAmount,
          refundAmount,
          reason: input.reason,
          isManualAdjustment: isManual,
          adjustmentNote: input.adjustmentNote,
        },
      });

      if (refundAmount > 0n) {
        await mutateWallet(tx, {
          userId: booking.userId,
          amount: refundAmount,
          type: 'BOOKING_REFUND',
          description: `بازگشت وجه لغو رزرو ${booking.court.name}`,
          referenceKey: `booking:${booking.id}:refund`,
          bookingId: booking.id,
          performedBy: input.cancelledBy,
          metadata: { penaltyPercent, policyName: quote.policyName },
        });
      }

      /* ---- بنِ خرج‌شده برمی‌گردد ----
         رزروی که با بن رایگان شده، مبلغ ریالی‌اش صفر است؛ پس بازگشت وجه
         چیزی به بازیکن نمی‌دهد. اگر بن را هم پس ندهیم، بازیکن هم امتیازش
         را از دست داده و هم رزروش را. تا وقتی تاریخ انقضا نگذشته باشد، بن
         دوباره فعال می‌شود. */
      const usedVoucher = await tx.bookingVoucher.findUnique({
        where: { bookingId: booking.id },
        select: { id: true, code: true, expiresAt: true },
      });
      let restoredVoucher: string | null = null;
      if (usedVoucher) {
        const stillValid = usedVoucher.expiresAt.getTime() > Date.now();
        await tx.bookingVoucher.update({
          where: { id: usedVoucher.id },
          data: {
            status: stillValid ? 'ACTIVE' : 'EXPIRED',
            usedAt: null,
            bookingId: null,
          },
        });
        if (stillValid) restoredVoucher = usedVoucher.code;
      }

      /* ---- پاداش وفاداری پس گرفته می‌شود ----
         وگرنه «رزرو کن و لغو کن» به یک ماشین تولید امتیاز تبدیل می‌شد.
         اگر بازیکن آن امتیازها را خرج کرده باشد، فقط تا سقف موجودی‌اش کم
         می‌کنیم؛ موجودی هرگز منفی نمی‌شود. */
      const rewardTx = await tx.pointsTransaction.findUnique({
        where: { referenceKey: `booking:${booking.id}:reward` },
        select: { amount: true },
      });
      if (rewardTx && rewardTx.amount > 0) {
        const profile = await tx.profile.findUnique({
          where: { userId: booking.userId },
          select: { points: true },
        });
        const clawback = Math.min(rewardTx.amount, profile?.points ?? 0);
        if (clawback > 0) {
          await mutatePoints(tx, {
            userId: booking.userId,
            amount: -clawback,
            type: 'BOOKING_REWARD_REVERSAL',
            description: `پس‌گرفتن پاداش رزرو لغوشده ${booking.court.name}`,
            referenceKey: `booking:${booking.id}:reward-reversal`,
            metadata: { bookingId: booking.id, granted: rewardTx.amount },
          });
        }
      }

      /* اگر روی این رزرو بازی بازی ساخته شده، سهم بازیکنان درون همین تراکنش
         بازمی‌گردد تا لغو رزرو و بازگشت سهم‌ها یکجا اتفاق بیفتد یا هیچ‌کدام. */
      const match = booking.openMatch
        ? await cancelOpenMatch(tx, booking.openMatch.id, input.reason ?? 'لغو رزرو')
        : null;

      return {
        booking,
        refundAmount,
        penaltyAmount,
        penaltyPercent,
        quote,
        match,
        restoredVoucher,
      };
    },
    { isolationLevel: 'ReadCommitted', timeout: 20_000 },
  ).then(async (result) => {
    await notify({
      userId: result.booking.userId,
      type: 'BOOKING_CANCELLED',
      title: 'رزرو شما لغو شد',
      body:
        result.restoredVoucher !== null
          ? `${result.booking.court.name} — ${formatDateTime(result.booking.startsAt)}. بن ${result.restoredVoucher} دوباره قابل استفاده شد.`
          : result.refundAmount > 0n
            ? `${result.booking.court.name} — ${formatDateTime(result.booking.startsAt)}. مبلغ ${formatToman(result.refundAmount)} به کیف پول شما بازگشت.`
            : `${result.booking.court.name} — ${formatDateTime(result.booking.startsAt)}.`,
      actionUrl: result.restoredVoucher !== null ? '/vouchers' : '/wallet',
      data: { bookingId: result.booking.id },
    });

    for (const userId of result.match?.guests ?? []) {
      await notify({
        userId,
        type: 'MATCH_CANCELLED',
        title: 'بازی لغو شد',
        body: `بازی ${result.booking.court.name} — ${formatDateTime(result.booking.startsAt)} لغو شد و سهم شما به کیف پول بازگشت.`,
        actionUrl: '/wallet',
      });
    }

    return result;
  });
}
