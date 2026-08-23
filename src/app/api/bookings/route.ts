import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { createBooking } from '@/lib/booking';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { fail, handleApiError, ok } from '@/lib/api';
import { createBookingSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** فهرست رزروهای کاربر */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') ?? 'all';
    const now = new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        ...(scope === 'upcoming'
          ? { startsAt: { gte: now }, status: { in: ['CONFIRMED', 'PENDING'] } }
          : scope === 'past'
            ? { OR: [{ startsAt: { lt: now } }, { status: { in: ['CANCELLED', 'COMPLETED'] } }] }
            : {}),
      },
      orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
      take: 100,
      include: { court: { select: { name: true } }, cancellation: true },
    });

    return ok({ bookings });
  } catch (error) {
    return handleApiError(error);
  }
}

/** ثبت رزرو جدید — قیمت‌گذاری و کسر وجه کاملاً سمت سرور انجام می‌شود */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const limited = await rateLimit(
      `booking:${user.id}`,
      RATE_LIMITS.BOOKING_CREATE.limit,
      RATE_LIMITS.BOOKING_CREATE.window,
    );
    if (!limited.allowed) return fail('تعداد درخواست‌های شما زیاد است. کمی بعد تلاش کنید.', 429);

    const body = await req.json();
    const input = createBookingSchema.parse(body);

    const booking = await createBooking({
      userId: user.id,
      courtId: input.courtId,
      slotStarts: input.slots.map((s) => new Date(s)),
      notes: input.notes,
      source: 'PLAYER',
    });

    return ok({ id: booking.id, code: booking.code, totalPrice: booking.totalPrice }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
