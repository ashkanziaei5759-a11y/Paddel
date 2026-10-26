import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/rbac';
import { getCourtAvailability } from '@/lib/booking';
import { handleApiError, ok } from '@/lib/api';
import { availabilityQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * سانس‌های همه‌ی زمین‌ها برای پیشخوان.
 * مدیر کل هر سانسِ خالی را می‌تواند بگیرد (حتی گذشته یا مسدود)؛ ادمین پذیرش
 * محدودیت «فاصله تا شروع» را ندارد ولی سانس گذشته و مسدود را نمی‌گیرد.
 * برای سانس‌های پر، نام صاحب رزرو هم برمی‌گردد.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireStaff();
    const { searchParams } = new URL(req.url);
    const input = availabilityQuerySchema.parse({ date: searchParams.get('date') ?? '' });

    const courts = await prisma.court.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { pricingRules: { where: { isActive: true } } },
    });
    const availability = await Promise.all(courts.map((court) => getCourtAvailability(court, input.date)));

    const allSlots = availability.flatMap((c) => c.slots.map((s) => ({ courtId: c.court.id, startsAt: s.startsAt })));
    const owners = allSlots.length
      ? await prisma.bookingSlot.findMany({
          where: {
            OR: availability.map((c) => ({
              courtId: c.court.id,
              startsAt: { gte: new Date(c.slots[0]?.startsAt ?? 0), lte: new Date(c.slots.at(-1)?.startsAt ?? 0) },
            })),
            booking: { status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
          },
          select: {
            courtId: true,
            startsAt: true,
            booking: { select: { id: true, user: { select: { username: true, profile: { select: { firstName: true, lastName: true } } } } } },
          },
        })
      : [];
    const ownerOf = new Map(
      owners.map((o) => [
        `${o.courtId}|${o.startsAt.toISOString()}`,
        {
          bookingId: o.booking.id,
          name: `${o.booking.user.profile?.firstName ?? ''} ${o.booking.user.profile?.lastName ?? ''}`.trim() || o.booking.user.username,
        },
      ]),
    );

    const isAdmin = actor.role === 'ADMIN';
    return ok({
      date: input.date,
      courts: availability.map((c) => ({
        court: c.court,
        slots: c.slots.map((s) => ({
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          price: s.price,
          reason: s.reason,
          selectable:
            s.reason === null ||
            s.reason === 'LEAD_TIME' ||
            (isAdmin && (s.reason === 'PAST' || s.reason === 'BLACKOUT')),
          owner: ownerOf.get(`${c.court.id}|${s.startsAt}`) ?? null,
        })),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
