import 'server-only';
import { prisma } from './db';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * محدودسازی نرخ با پنجره‌ی ثابت، پشتوانه‌ی پایگاه داده.
 * برای استقرار چندنمونه‌ای پایدار است (بر خلاف حافظه‌ی درون‌فرایندی).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000);

  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.windowEnd.getTime() <= now.getTime()) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowEnd },
      update: { count: 1, windowEnd },
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.windowEnd.getTime() - now.getTime()) / 1000)),
    };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, remaining: Math.max(0, limit - updated.count), retryAfterSeconds: 0 };
}

/** پاک‌سازی رکوردهای منقضی — قابل فراخوانی از یک cron */
export async function purgeExpiredRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowEnd: { lt: new Date() } },
  });
  return count;
}

export const RATE_LIMITS = {
  OTP_REQUEST: { limit: 3, window: 10 * 60 },
  OTP_VERIFY: { limit: 10, window: 10 * 60 },
  LOGIN: { limit: 10, window: 10 * 60 },
  SIGNUP: { limit: 5, window: 60 * 60 },
  PAYMENT_INIT: { limit: 10, window: 10 * 60 },
  BOOKING_CREATE: { limit: 20, window: 10 * 60 },
} as const;
