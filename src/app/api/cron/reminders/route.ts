import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { formatTime } from '@/lib/datetime';
import { handleApiError, ok, AppError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** پنجره‌ی یادآوری: رزروهایی که بین ۶۰ تا ۹۰ دقیقه‌ی دیگر شروع می‌شوند */
const WINDOW_START_MINUTES = 60;
const WINDOW_END_MINUTES = 90;

/**
 * یادآوری رزرو، حدود یک ساعت پیش از شروع بازی.
 *
 * قرار است هر ۳۰ دقیقه صدا زده شود (Vercel Cron یا هر زمان‌بند دیگری). پنجره
 * از یک ساعت تا یک‌ساعت‌ونیم است تا اگر یک اجرا از دست برود، اجرای بعدی
 * همان رزروها را بگیرد. برای اینکه کسی دو بار یادآوری نگیرد، پیش از ساختن
 * اعلان، وجود یادآوری قبلی برای همان رزرو بررسی می‌شود.
 *
 * دسترسی با CRON_SECRET بسته است؛ بدون آن هر کسی می‌توانست با صدا زدن مکرر
 * این مسیر، صندوق اعلان بازیکنان را پر کند.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new AppError('زمان‌بند پیکربندی نشده است.', 503);

    const header = req.headers.get('authorization');
    if (header !== `Bearer ${secret}`) throw new AppError('دسترسی ندارید.', 401);

    const now = Date.now();
    const from = new Date(now + WINDOW_START_MINUTES * 60_000);
    const to = new Date(now + WINDOW_END_MINUTES * 60_000);

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        userId: true,
        startsAt: true,
        court: { select: { name: true } },
      },
    });

    if (bookings.length === 0) return ok({ sent: 0, checked: 0 });

    /* کدام رزروها از قبل یادآوری گرفته‌اند؟ */
    const already = await prisma.notification.findMany({
      where: {
        type: 'BOOKING_REMINDER',
        userId: { in: bookings.map((b) => b.userId) },
        actionUrl: { in: bookings.map((b) => `/bookings/${b.id}`) },
      },
      select: { userId: true, actionUrl: true },
    });
    const sent = new Set(already.map((n) => `${n.userId}|${n.actionUrl}`));

    const pending = bookings.filter((b) => !sent.has(`${b.userId}|/bookings/${b.id}`));
    if (pending.length === 0) return ok({ sent: 0, checked: bookings.length });

    await notifyMany(
      pending.map((b) => ({
        userId: b.userId,
        type: 'BOOKING_REMINDER' as const,
        title: 'یک ساعت تا بازی شما ⏰',
        body: `رزرو شما در ${b.court.name} ساعت ${formatTime(b.startsAt)} شروع می‌شود.`,
        actionUrl: `/bookings/${b.id}`,
      })),
    );

    return ok({ sent: pending.length, checked: bookings.length });
  } catch (error) {
    return handleApiError(error);
  }
}
