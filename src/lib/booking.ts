import 'server-only';
import type { Court, CourtPricingRule, Prisma } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';
import { mutateWallet } from './wallet';
import { priceForSlot, type SlotPrice } from './pricing';
import { addDays, dayKey, parseDayKey, startOfLocalDay, toFaDigits, zonedToUtc } from './datetime';
import { generateBookingCode } from './utils';
import { notify } from './notifications';
import { formatDateTime } from './datetime';
import { formatToman } from './utils';

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  startMinute: number;
  price: string;
  ruleName: string | null;
  available: boolean;
  /** دلیل غیرقابل انتخاب بودن */
  reason: 'BOOKED' | 'PAST' | 'BLACKOUT' | 'LEAD_TIME' | null;
  isMine: boolean;
}

export interface CourtAvailability {
  court: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    slotDurationMinutes: number;
    maxConsecutiveSlots: number;
    basePrice: string;
  };
  slots: AvailabilitySlot[];
}

/** فهرست زمان شروع سانس‌های یک روز بر اساس ساعات کاری زمین */
export function slotStartsForDay(court: Court, dayKeyStr: string): Date[] {
  const { gy, gm, gd } = parseDayKey(dayKeyStr);
  const starts: Date[] = [];
  const duration = court.slotDurationMinutes;

  for (let m = court.openingMinute; m + duration <= court.closingMinute; m += duration) {
    starts.push(zonedToUtc(gy, gm, gd, m));
  }
  return starts;
}

/** وضعیت سانس‌های یک زمین در یک روز */
export async function getCourtAvailability(
  court: Court & { pricingRules: CourtPricingRule[] },
  dayKeyStr: string,
  viewerId?: string,
): Promise<CourtAvailability> {
  const starts = slotStartsForDay(court, dayKeyStr);
  if (starts.length === 0) {
    return { court: courtSummary(court), slots: [] };
  }

  const dayStart = starts[0];
  const dayEnd = new Date(
    starts[starts.length - 1].getTime() + court.slotDurationMinutes * 60_000,
  );

  const [taken, blackouts] = await Promise.all([
    prisma.bookingSlot.findMany({
      where: {
        courtId: court.id,
        startsAt: { gte: dayStart, lt: dayEnd },
        booking: { status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      },
      select: { startsAt: true, booking: { select: { userId: true } } },
    }),
    prisma.courtBlackout.findMany({
      where: { courtId: court.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const takenMap = new Map(taken.map((t) => [t.startsAt.getTime(), t.booking.userId]));
  const now = Date.now();
  const leadMs = court.minLeadTimeMinutes * 60_000;

  const slots: AvailabilitySlot[] = starts.map((startsAt) => {
    const endsAt = new Date(startsAt.getTime() + court.slotDurationMinutes * 60_000);
    const { price, ruleName } = priceForSlot(court, court.pricingRules, startsAt);
    const ownerId = takenMap.get(startsAt.getTime());

    let reason: AvailabilitySlot['reason'] = null;
    if (ownerId) reason = 'BOOKED';
    else if (startsAt.getTime() <= now) reason = 'PAST';
    else if (startsAt.getTime() - now < leadMs) reason = 'LEAD_TIME';
    else if (blackouts.some((b) => b.startsAt < endsAt && b.endsAt > startsAt)) reason = 'BLACKOUT';

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      startMinute:
        Math.round((startsAt.getTime() - startOfLocalDay(startsAt).getTime()) / 60_000) % 1440,
      price: price.toString(),
      ruleName,
      available: reason === null,
      reason,
      isMine: Boolean(viewerId && ownerId === viewerId),
    };
  });

  return { court: courtSummary(court), slots };
}

function courtSummary(court: Court) {
  return {
    id: court.id,
    name: court.name,
    slug: court.slug,
    description: court.description,
    imageUrl: court.imageUrl,
    slotDurationMinutes: court.slotDurationMinutes,
    maxConsecutiveSlots: court.maxConsecutiveSlots,
    basePrice: court.basePrice.toString(),
  };
}

export interface CreateBookingInput {
  userId: string;
  courtId: string;
  /** زمان شروع سانس‌های انتخاب‌شده — باید پشت‌سرهم باشند */
  slotStarts: Date[];
  source?: 'PLAYER' | 'ADMIN' | 'TOURNAMENT';
  notes?: string;
  performedBy?: string;
  /** رزرو ادمین بدون کسر از کیف پول */
  skipPayment?: boolean;
}

/**
 * ثبت رزرو به‌صورت اتمیک:
 *   ۱) اعتبارسنجی سانس‌ها (پیوستگی، ساعات کاری، مهلت، بازه‌های مسدود)
 *   ۲) قیمت‌گذاری سمت سرور — قیمت ارسالی کلاینت هرگز پذیرفته نمی‌شود
 *   ۳) کسر از کیف پول با قفل ردیف
 *   ۴) درج BookingSlot با کلید یکتای [courtId, startsAt]
 *
 * اگر دو کاربر هم‌زمان یک سانس را بگیرند، محدودیت یکتای پایگاه داده
 * دومی را رد می‌کند و کل تراکنش (از جمله کسر وجه) بازگردانی می‌شود.
 */
export async function createBooking(input: CreateBookingInput) {
  if (input.slotStarts.length === 0) {
    throw new AppError('حداقل یک سانس باید انتخاب شود.');
  }

  const court = await prisma.court.findUnique({
    where: { id: input.courtId },
    include: { pricingRules: { where: { isActive: true } } },
  });

  if (!court) throw new AppError('زمین موردنظر یافت نشد.', 404);
  if (!court.isActive) throw new AppError('این زمین در حال حاضر غیرفعال است.');

  const starts = [...input.slotStarts].sort((a, b) => a.getTime() - b.getTime());
  const durationMs = court.slotDurationMinutes * 60_000;

  if (starts.length > court.maxConsecutiveSlots && input.source !== 'ADMIN') {
    throw new AppError(
      `حداکثر ${toFaDigits(court.maxConsecutiveSlots)} سانس پشت‌سرهم قابل رزرو است.`,
    );
  }

  // پیوستگی سانس‌ها
  for (let i = 1; i < starts.length; i += 1) {
    if (starts[i].getTime() - starts[i - 1].getTime() !== durationMs) {
      throw new AppError('سانس‌های انتخاب‌شده باید پشت‌سرهم باشند.');
    }
  }

  const now = Date.now();
  const validStarts = new Set(
    slotStartsForDay(court, dayKey(starts[0])).map((d) => d.getTime()),
  );

  for (const start of starts) {
    if (!validStarts.has(start.getTime())) {
      // ممکن است سانس‌ها به روز بعد سرریز کرده باشند
      const alt = new Set(slotStartsForDay(court, dayKey(start)).map((d) => d.getTime()));
      if (!alt.has(start.getTime())) {
        throw new AppError('سانس انتخاب‌شده با ساعات کاری زمین هم‌خوانی ندارد.');
      }
    }
    if (input.source !== 'ADMIN') {
      if (start.getTime() <= now) throw new AppError('امکان رزرو سانس گذشته وجود ندارد.');
      if (start.getTime() - now < court.minLeadTimeMinutes * 60_000) {
        throw new AppError('فاصله تا شروع این سانس برای رزرو کافی نیست.');
      }
      const maxDate = addDays(new Date(now), court.advanceBookingDays).getTime();
      if (start.getTime() > maxDate) {
        throw new AppError(
          `رزرو حداکثر تا ${toFaDigits(court.advanceBookingDays)} روز آینده ممکن است.`,
        );
      }
    }
  }

  const endsAt = new Date(starts[starts.length - 1].getTime() + durationMs);

  const blackout = await prisma.courtBlackout.findFirst({
    where: { courtId: court.id, startsAt: { lt: endsAt }, endsAt: { gt: starts[0] } },
  });
  if (blackout && input.source === 'PLAYER') {
    throw new AppError('این بازه توسط باشگاه مسدود شده است.');
  }

  // قیمت‌گذاری سمت سرور
  const priced: SlotPrice[] = starts.map((startsAt) => {
    const { price, ruleName } = priceForSlot(court, court.pricingRules, startsAt);
    return { startsAt, endsAt: new Date(startsAt.getTime() + durationMs), price, ruleName };
  });
  const totalPrice = priced.reduce((sum, s) => sum + s.price, 0n);

  const booking = await prisma.$transaction(
    async (tx) => {
      const created = await tx.booking.create({
        data: {
          code: generateBookingCode(),
          userId: input.userId,
          courtId: court.id,
          startsAt: starts[0],
          endsAt,
          slotCount: starts.length,
          status: 'CONFIRMED',
          source: input.source ?? 'PLAYER',
          totalPrice: input.skipPayment ? 0n : totalPrice,
          notes: input.notes,
          priceBreakdown: priced.map((p) => ({
            startsAt: p.startsAt.toISOString(),
            endsAt: p.endsAt.toISOString(),
            price: p.price.toString(),
            ruleName: p.ruleName,
          })) as Prisma.InputJsonValue,
        },
      });

      // درج سانس‌ها — کلید یکتا مانع رزرو هم‌زمان می‌شود
      try {
        await tx.bookingSlot.createMany({
          data: priced.map((p) => ({
            bookingId: created.id,
            courtId: court.id,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            price: p.price,
          })),
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          (error as { code?: string }).code === 'P2002'
        ) {
          throw new AppError(
            'متأسفانه این سانس همین لحظه توسط کاربر دیگری رزرو شد. لطفاً ساعت دیگری انتخاب کنید.',
            409,
            'SLOT_TAKEN',
          );
        }
        throw error;
      }

      if (!input.skipPayment && totalPrice > 0n) {
        await mutateWallet(tx, {
          userId: input.userId,
          amount: -totalPrice,
          type: 'BOOKING_PAYMENT',
          description: `پرداخت رزرو ${court.name}`,
          referenceKey: `booking:${created.id}:payment`,
          bookingId: created.id,
          performedBy: input.performedBy,
        });
      }

      return created;
    },
    { isolationLevel: 'ReadCommitted', timeout: 20_000 },
  );

  await notify({
    userId: input.userId,
    type: 'BOOKING_CONFIRMED',
    title: 'رزرو شما ثبت شد 🎾',
    body: `${court.name} — ${formatDateTime(booking.startsAt)} · ${formatToman(booking.totalPrice)}`,
    actionUrl: `/bookings/${booking.id}`,
    data: { bookingId: booking.id, code: booking.code },
  });

  return booking;
}
