import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/rbac';
import { cancelBooking, quoteRefund } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import { AppError, handleApiError, ok } from '@/lib/api';
import { cancelBookingSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/** پیش‌نمایش مبلغ بازگشتی پیش از لغو */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new AppError('رزرو یافت نشد.', 404);
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      throw new AppError('دسترسی مجاز نیست.', 403);
    }

    const quote = await quoteRefund(booking.totalPrice, booking.startsAt);
    return ok({ quote, totalPrice: booking.totalPrice });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const input = cancelBookingSchema.parse(body);

    const result = await cancelBooking({
      bookingId: id,
      cancelledBy: user.id,
      cancelledRole: user.role,
      reason: input.reason,
    });

    return ok({
      refundAmount: result.refundAmount,
      penaltyAmount: result.penaltyAmount,
      penaltyPercent: result.penaltyPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
