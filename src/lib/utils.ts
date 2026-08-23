import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toFaDigits } from './datetime';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** مبالغ در پایگاه داده به ریال ذخیره می‌شوند و به تومان نمایش داده می‌شوند. */
export const RIAL_PER_TOMAN = 10;

export function rialToToman(rial: bigint | number): number {
  return Math.round(Number(rial) / RIAL_PER_TOMAN);
}

export function tomanToRial(toman: number): bigint {
  return BigInt(Math.round(toman) * RIAL_PER_TOMAN);
}

/** «۱٬۲۵۰٬۰۰۰ تومان» */
export function formatToman(rial: bigint | number, opts?: { withUnit?: boolean }): string {
  const toman = rialToToman(rial);
  const grouped = toFaDigits(Math.abs(toman).toLocaleString('en-US'));
  const sign = toman < 0 ? '−' : '';
  return `${sign}${grouped}${opts?.withUnit === false ? '' : ' تومان'}`;
}

export function formatNumber(value: number | bigint): string {
  return toFaDigits(Number(value).toLocaleString('en-US'));
}

/** تولید کد یکتای رزرو مثل PP-7K3M9Q */
export function generateBookingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `PP-${out}`;
}

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[\s‌]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `item-${Date.now().toString(36)}`;
}

/** نرمال‌سازی شماره موبایل ایران به قالب 09xxxxxxxxx */
export function normalizePhone(input: string): string | null {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\d+]/g, '');

  let n = digits;
  if (n.startsWith('+98')) n = `0${n.slice(3)}`;
  else if (n.startsWith('0098')) n = `0${n.slice(4)}`;
  else if (n.startsWith('98') && n.length === 12) n = `0${n.slice(2)}`;
  else if (n.startsWith('9') && n.length === 10) n = `0${n}`;

  return /^09\d{9}$/.test(n) ? n : null;
}

/** پوشاندن بخشی از شماره: ۰۹۱۲***۴۵۶۷ */
export function maskPhone(phone: string): string {
  if (phone.length !== 11) return toFaDigits(phone);
  return toFaDigits(`${phone.slice(0, 4)}***${phone.slice(7)}`);
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || '؟';
}

/** درصد پیشرفت با محدوده‌ی ۰ تا ۱۰۰ */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * ایزوله‌سازی دوجهته برای مقادیری که درون رشته‌های فارسی درج می‌شوند.
 * از چسبیدن اعداد دو طرفِ جداکننده‌ها (مانند «·») به یکدیگر جلوگیری می‌کند.
 */
export function iso(value: string | number): string {
  return `\u2068${value}\u2069`;
}
