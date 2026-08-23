import 'server-only';
import type { Court, CourtPricingRule } from '@prisma/client';
import { minutesOfDay, persianWeekdayIndex } from './datetime';

export interface SlotPrice {
  startsAt: Date;
  endsAt: Date;
  price: bigint;
  ruleName: string | null;
}

/**
 * قیمت یک سانس بر اساس قوانین قیمت‌گذاری زمین.
 * قانونی که بازه‌ی زمانی و روز هفته را پوشش دهد و بالاترین اولویت را داشته باشد برنده است؛
 * در نبود قانون، قیمت پایه‌ی زمین اعمال می‌شود.
 */
export function priceForSlot(
  court: Pick<Court, 'basePrice'>,
  rules: CourtPricingRule[],
  startsAt: Date,
): { price: bigint; ruleName: string | null } {
  const minute = minutesOfDay(startsAt);
  const weekday = persianWeekdayIndex(startsAt);
  const now = startsAt.getTime();

  const matching = rules
    .filter((rule) => {
      if (!rule.isActive) return false;
      if (rule.validFrom && rule.validFrom.getTime() > now) return false;
      if (rule.validUntil && rule.validUntil.getTime() < now) return false;
      if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(weekday)) return false;
      return minute >= rule.startMinute && minute < rule.endMinute;
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      // بازه‌ی باریک‌تر، اختصاصی‌تر است
      return a.endMinute - a.startMinute - (b.endMinute - b.startMinute);
    });

  const winner = matching[0];
  return winner
    ? { price: winner.price, ruleName: winner.name }
    : { price: court.basePrice, ruleName: null };
}

export function priceSlots(
  court: Pick<Court, 'basePrice' | 'slotDurationMinutes'>,
  rules: CourtPricingRule[],
  starts: Date[],
): SlotPrice[] {
  return starts.map((startsAt) => {
    const { price, ruleName } = priceForSlot(court, rules, startsAt);
    return {
      startsAt,
      endsAt: new Date(startsAt.getTime() + court.slotDurationMinutes * 60_000),
      price,
      ruleName,
    };
  });
}

export function sumPrices(slots: SlotPrice[]): bigint {
  return slots.reduce((total, slot) => total + slot.price, 0n);
}
