import 'server-only';
import { prisma } from './db';
import { AppError } from './api';
import { cancelBooking } from './cancellation';
import { revokeAllSessions } from './auth/session';

/**
 * حذف کامل حساب کاربر توسط مدیر کل.
 *
 * بیشتر داده‌های کاربر (پروفایل، کیف پول، تراکنش‌ها، اعلان‌ها، نشست‌ها و…) با
 * حذف خود کاربر پاک می‌شوند. سه چیز اما مانع حذف مستقیم‌اند و جدا رسیدگی می‌شوند:
 *
 *  ۱. رزروهای آینده — اول لغو می‌شوند تا سانس آزاد شود و اگر روی رزرو «بازی باز»
 *     ساخته شده، سهم بازیکنان دیگر به کیف پولشان برگردد. (بازگشتی به کیف پول
 *     خود کاربر داده نمی‌شود؛ آن کیف پول همراه حساب حذف می‌شود.)
 *  ۲. ثبت‌نام‌های تورنومنت که کاربر ساخته — به نام مدیری که حذف می‌کند منتقل
 *     می‌شوند تا تیم‌ها و جدول تورنومنت به‌هم نریزد.
 *  ۳. رزروهای گذشته و بازی‌هایی که میزبانشان بوده — پاک می‌شوند.
 *  ۴. جایش در بازی بازِ فعالِ دیگران — آزاد می‌شود و سهمش از صندوق بازی کم
 *     می‌شود، وگرنه بازی «پر» می‌ماند و میزبان سهمِ حسابی حذف‌شده را می‌گرفت.
 *
 * اول حساب غیرفعال و از همه‌ی دستگاه‌ها خارج می‌شود تا وسط کار رزرو تازه‌ای
 * ثبت نشود. اگر مرحله‌ی آخر شکست بخورد، حساب غیرفعال باقی می‌ماند و می‌شود
 * دوباره حذفش کرد.
 */

export interface DeletionSummary {
  username: string;
  name: string;
  role: string;
  walletBalance: string;
  upcomingBookings: number;
  pastBookings: number;
  successfulPayments: number;
}

export async function userDeletionSummary(userId: string): Promise<DeletionSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      role: true,
      wallet: { select: { balance: true } },
      profile: { select: { firstName: true, lastName: true } },
    },
  });
  if (!user) throw new AppError('کاربر پیدا نشد.', 404);

  const now = new Date();
  const [upcomingBookings, pastBookings, successfulPayments] = await Promise.all([
    prisma.booking.count({
      where: { userId, startsAt: { gt: now }, status: { in: ['CONFIRMED', 'PENDING'] } },
    }),
    prisma.booking.count({
      where: { userId, NOT: { startsAt: { gt: now }, status: { in: ['CONFIRMED', 'PENDING'] } } },
    }),
    prisma.payment.count({ where: { userId, status: 'SUCCESS' } }),
  ]);

  return {
    username: user.username,
    name: `${user.profile?.firstName ?? ''} ${user.profile?.lastName ?? ''}`.trim() || user.username,
    role: user.role,
    walletBalance: (user.wallet?.balance ?? 0n).toString(),
    upcomingBookings,
    pastBookings,
    successfulPayments,
  };
}

export async function deleteUserCompletely(input: {
  userId: string;
  actorId: string;
  /** اگر داده شود باید دقیقاً نام کاربری هدف باشد (تأیید حذف تکی از پنل) */
  confirmUsername?: string;
}) {
  const { userId, actorId } = input;
  if (userId === actorId) throw new AppError('نمی‌توانید حساب خودتان را حذف کنید.', 400);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true },
  });
  if (!target) throw new AppError('کاربر پیدا نشد.', 404);
  if (input.confirmUsername !== undefined && input.confirmUsername.trim().toLowerCase() !== target.username) {
    throw new AppError('برای تأیید، نام کاربری را دقیق وارد کنید.', 400);
  }

  if (target.role === 'ADMIN') {
    const otherAdmins = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE', NOT: { id: userId } },
    });
    if (otherAdmins === 0) throw new AppError('آخرین مدیر کل را نمی‌توان حذف کرد.', 400);
  }

  /* بازی بازی که میزبانش این کاربر است ولی روی رزرو کس دیگری ساخته شده:
     نمی‌دانیم با سهم بقیه چه کنیم، پس حذف را متوقف می‌کنیم. */
  const foreignHosted = await prisma.openMatch.count({
    where: {
      hostId: userId,
      status: { in: ['OPEN', 'FULL'] },
      booking: { userId: { not: userId } },
    },
  });
  if (foreignHosted > 0) {
    throw new AppError('این کاربر میزبان بازی بازی روی رزرو شخص دیگری است؛ اول آن بازی را لغو کنید.', 409);
  }

  // جلوی رزرو تازه در حین حذف را می‌گیرد (پذیرش هم برای حساب غیرفعال رزرو نمی‌کند)
  await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
  await revokeAllSessions(userId);

  // ۱. لغو رزروهای آینده (و بازگرداندن سهم بازیکنان بازی‌های باز)
  const upcoming = await prisma.booking.findMany({
    where: { userId, startsAt: { gt: new Date() }, status: { in: ['CONFIRMED', 'PENDING'] } },
    select: { id: true },
  });
  for (const b of upcoming) {
    await cancelBooking({
      bookingId: b.id,
      cancelledBy: actorId,
      cancelledRole: 'ADMIN',
      reason: 'حذف حساب کاربر توسط مدیر',
      overrideRefundAmount: 0n,
      adjustmentNote: 'حساب کاربر حذف شد',
    });
  }

  // ۲ و ۳. بقیه در یک تراکنش
  await prisma.$transaction(
    async (tx) => {
      /* ۴. آزاد کردن جایش در بازی‌های بازِ فعالِ دیگران */
      const seats = await tx.openMatchPlayer.findMany({
        where: { userId, isHost: false, match: { status: { in: ['OPEN', 'FULL'] }, hostId: { not: userId } } },
        select: { id: true, matchId: true, paidAmount: true },
      });
      for (const seat of seats) {
        await tx.openMatchPlayer.delete({ where: { id: seat.id } });
        await tx.openMatch.update({
          where: { id: seat.matchId },
          data: { escrowBalance: { decrement: seat.paidAmount }, status: 'OPEN' },
        });
      }

      await tx.tournamentRegistration.updateMany({
        where: { createdById: userId },
        data: { createdById: actorId },
      });
      /* رزروها بازی‌های بازِ رویشان، سانس‌ها و سوابق لغو را هم با خود می‌برند */
      await tx.booking.deleteMany({ where: { userId } });
      await tx.openMatch.deleteMany({ where: { hostId: userId } });
      await tx.notificationRuleDelivery.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ADMIN_DELETE_USER',
          entityType: 'User',
          entityId: userId,
          before: { username: target.username, role: target.role },
        },
      });
    },
    { timeout: 30_000 },
  );

  return { username: target.username, cancelledBookings: upcoming.length };
}
