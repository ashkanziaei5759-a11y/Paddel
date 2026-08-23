import 'server-only';
import type { Prisma, PointsTxType } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';

export interface PointsMutation {
  userId: string;
  /** مثبت = دریافت، منفی = کسر */
  amount: number;
  type: PointsTxType;
  description?: string;
  referenceKey?: string;
  tournamentId?: string;
  performedById?: string;
  metadata?: Prisma.InputJsonValue;
  allowNegative?: boolean;
}

/**
 * دفتر کل امتیاز — منبع حقیقت `PointsTransaction` است و
 * `Profile.points` صرفاً مقدار کش‌شده برای نمایش سریع است.
 * همین ساختار، پایه‌ی فروشگاهِ مبتنی بر امتیاز در آینده خواهد بود.
 */
export async function mutatePoints(
  tx: Prisma.TransactionClient,
  input: PointsMutation,
): Promise<{ points: number; transactionId: string }> {
  if (input.amount === 0) throw new AppError('مقدار امتیاز نمی‌تواند صفر باشد.');

  if (input.referenceKey) {
    const existing = await tx.pointsTransaction.findUnique({
      where: { referenceKey: input.referenceKey },
    });
    if (existing) return { points: existing.balanceAfter, transactionId: existing.id };
  }

  const locked = await tx.$queryRaw<{ id: string; points: number }[]>`
    SELECT id, points FROM "profiles" WHERE "userId" = ${input.userId} FOR UPDATE
  `;
  if (locked.length === 0) throw new AppError('پروفایل کاربر یافت نشد.', 404);

  const profileId = locked[0].id;
  const balanceBefore = Number(locked[0].points);
  const balanceAfter = balanceBefore + input.amount;

  if (balanceAfter < 0 && !input.allowNegative) {
    throw new AppError('امتیاز کافی نیست.', 400, 'INSUFFICIENT_POINTS');
  }

  await tx.profile.update({ where: { id: profileId }, data: { points: balanceAfter } });

  const record = await tx.pointsTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceBefore,
      balanceAfter,
      description: input.description,
      referenceKey: input.referenceKey,
      tournamentId: input.tournamentId,
      performedById: input.performedById,
      metadata: input.metadata,
    },
  });

  return { points: balanceAfter, transactionId: record.id };
}

export async function mutatePointsStandalone(input: PointsMutation) {
  return prisma.$transaction((tx) => mutatePoints(tx, input), { timeout: 15_000 });
}

/** بازسازی موجودی کش‌شده از روی دفتر کل — ابزار اصلاح برای ادمین */
export async function recalculatePoints(userId: string): Promise<number> {
  const agg = await prisma.pointsTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  const total = agg._sum.amount ?? 0;
  await prisma.profile.update({ where: { userId }, data: { points: total } });
  return total;
}
