/**
 * ابزارهای تاریخ و ساعت با مبنای منطقه‌ی زمانی باشگاه (پیش‌فرض: Asia/Tehran).
 * قاعده: همه چیز در پایگاه داده UTC ذخیره می‌شود و فقط در لایه‌ی نمایش
 * به وقت محلی تبدیل می‌گردد.
 */

import { JALALI_MONTHS, WEEKDAYS_FA, jsDayToPersianIndex, toGregorian, toJalali } from './jalali';

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tehran';

/** اختلاف منطقه‌ی زمانی نسبت به UTC بر حسب میلی‌ثانیه، در لحظه‌ی مشخص */
export function timeZoneOffsetMs(date: Date, timeZone: string = APP_TIMEZONE): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
}

/** اجزای تاریخ میلادی یک لحظه، به وقت محلی باشگاه */
export function zonedParts(date: Date, timeZone: string = APP_TIMEZONE) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
    jsWeekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * ساخت لحظه‌ی UTC از تاریخ میلادیِ محلی + دقیقه‌ی روز.
 * دو مرحله‌ای تا اختلاف ساعت تابستانی (در صورت وجود) درست اعمال شود.
 */
export function zonedToUtc(
  gy: number,
  gm: number,
  gd: number,
  minutesOfDay = 0,
  timeZone: string = APP_TIMEZONE,
): Date {
  const naive = Date.UTC(gy, gm - 1, gd, 0, 0, 0) + minutesOfDay * 60_000;
  let guess = new Date(naive - timeZoneOffsetMs(new Date(naive), timeZone));
  guess = new Date(naive - timeZoneOffsetMs(guess, timeZone));
  return guess;
}

/** ساخت لحظه‌ی UTC از تاریخ شمسی + دقیقه‌ی روز */
export function jalaliToUtc(jy: number, jm: number, jd: number, minutesOfDay = 0): Date {
  const g = toGregorian(jy, jm, jd);
  return zonedToUtc(g.gy, g.gm, g.gd, minutesOfDay);
}

/** «کلید روز» به قالب YYYY-MM-DD میلادی، بر مبنای وقت محلی باشگاه */
export function dayKey(date: Date, timeZone: string = APP_TIMEZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function parseDayKey(key: string): { gy: number; gm: number; gd: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error('قالب تاریخ نامعتبر است');
  return { gy: Number(m[1]), gm: Number(m[2]), gd: Number(m[3]) };
}

/** ابتدای روز محلی (به‌صورت لحظه‌ی UTC) */
export function startOfLocalDay(date: Date, timeZone: string = APP_TIMEZONE): Date {
  const p = zonedParts(date, timeZone);
  return zonedToUtc(p.year, p.month, p.day, 0, timeZone);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** دقیقه‌ی روز به وقت محلی */
export function minutesOfDay(date: Date, timeZone: string = APP_TIMEZONE): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** روز هفته با مبنای شنبه = ۰ */
export function persianWeekdayIndex(date: Date, timeZone: string = APP_TIMEZONE): number {
  return jsDayToPersianIndex(zonedParts(date, timeZone).jsWeekday);
}

// ---------------------------------------------------------------------------
// قالب‌بندی نمایشی
// ---------------------------------------------------------------------------

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** تبدیل ارقام لاتین به فارسی */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** تبدیل ارقام فارسی/عربی به لاتین — برای ورودی کاربر */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** «۱۴ مرداد ۱۴۰۴» */
export function formatJalaliDate(date: Date, opts?: { withWeekday?: boolean; short?: boolean }) {
  const p = zonedParts(date);
  const j = toJalali(p.year, p.month, p.day);
  const base = opts?.short
    ? `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`
    : `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`;
  if (!opts?.withWeekday) return base;
  return `${WEEKDAYS_FA[persianWeekdayIndex(date)]}، ${base}`;
}

/** «۱۸:۳۰» */
export function formatTime(date: Date): string {
  const p = zonedParts(date);
  return toFaDigits(`${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return toFaDigits(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

/** «شنبه، ۱۴ مرداد ۱۴۰۴ — ۱۸:۳۰» */
export function formatDateTime(date: Date, opts?: { withWeekday?: boolean }): string {
  return `${formatJalaliDate(date, { withWeekday: opts?.withWeekday ?? true })} — ${formatTime(date)}`;
}

/** فاصله‌ی زمانی خوانا: «۳ ساعت و ۲۰ دقیقه دیگر» */
export function formatRelative(target: Date, now = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const future = diffMs >= 0;
  const mins = Math.floor(Math.abs(diffMs) / 60_000);
  if (mins < 1) return future ? 'همین حالا' : 'لحظاتی پیش';
  if (mins < 60) return `${toFaDigits(mins)} دقیقه ${future ? 'دیگر' : 'پیش'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    const h = `${toFaDigits(hours)} ساعت`;
    const r = rem ? ` و ${toFaDigits(rem)} دقیقه` : '';
    return `${h}${r} ${future ? 'دیگر' : 'پیش'}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toFaDigits(days)} روز ${future ? 'دیگر' : 'پیش'}`;
  const months = Math.floor(days / 30);
  return `${toFaDigits(months)} ماه ${future ? 'دیگر' : 'پیش'}`;
}

/** مدت زمان: «۹۰ دقیقه» یا «۱ ساعت و ۳۰ دقیقه» */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${toFaDigits(minutes)} دقیقه`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!m) return `${toFaDigits(h)} ساعت`;
  return `${toFaDigits(h)} ساعت و ${toFaDigits(m)} دقیقه`;
}
