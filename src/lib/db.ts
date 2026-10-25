import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    /* پیش‌فرض prisma فقط ۲ ثانیه برای گرفتن اتصالِ شروع تراکنش صبر می‌کند.
       در تست بار، وقتی ۵۰ نفر هم‌زمان یک سانس را رزرو کردند، بقیه پشت قفلِ
       تراکنشِ اول صف کشیدند و ۱۲ نفر به‌جای پیام «این سانس گرفته شد» خطای ۵۰۰
       گرفتند (P2028). با ۱۰ ثانیه، زیر بار صبر می‌کنند و جواب درست می‌گیرند. */
    transactionOptions: { maxWait: 10_000 },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** BigInt در JSON پشتیبانی نمی‌شود — تبدیل امن برای پاسخ‌های API */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as T;
}
