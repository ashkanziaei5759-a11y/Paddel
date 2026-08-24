import 'server-only';
import type { Prisma, WalletTxType } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';

export interface WalletMutation {
  userId: string;
  /** مثبت = واریز، منفی = برداشت (ریال) */
  amount: bigint;
  type: WalletTxType;
  description?: string;
  /** کلید یکتا برای جلوگیری از اجرای دوباره‌ی یک عملیات */
  referenceKey?: string;
  bookingId?: string;
  paymentId?: string;
  registrationId?: string;
  storeOrderId?: string;
  performedBy?: string;
  metadata?: Prisma.InputJsonValue;
  /** اجازه‌ی منفی شدن موجودی (فقط اصلاحات ادمین) */
  allowNegative?: boolean;
}

/**
 * تغییر اتمیک موجودی کیف پول.
 * باید همیشه درون یک تراکنش پایگاه داده اجرا شود تا خرج دوباره (Double Spending) ممکن نباشد.
 * ردیف کیف پول با `SELECT ... FOR UPDATE` قفل می‌شود.
 */
export async function mutateWallet(
  tx: Prisma.TransactionClient,
  input: WalletMutation,
): Promise<{ balance: bigint; transactionId: string }> {
  if (input.amount === 0n) throw new AppError('مبلغ تراکنش نمی‌تواند صفر باشد.');

  // جلوگیری از اجرای تکراری بر اساس کلید یکتا
  if (input.referenceKey) {
    const existing = await tx.walletTransaction.findUnique({
      where: { referenceKey: input.referenceKey },
    });
    if (existing) {
      return { balance: existing.balanceAfter, transactionId: existing.id };
    }
  }

  // قفل انحصاری ردیف کیف پول تا پایان تراکنش
  const locked = await tx.$queryRaw<{ id: string; balance: bigint }[]>`
    SELECT id, balance FROM "wallets" WHERE "userId" = ${input.userId} FOR UPDATE
  `;

  if (locked.length === 0) throw new AppError('کیف پول کاربر یافت نشد.', 404);

  const walletId = locked[0].id;
  const balanceBefore = BigInt(locked[0].balance);
  const balanceAfter = balanceBefore + input.amount;

  if (balanceAfter < 0n && !input.allowNegative) {
    throw new AppError('موجودی کیف پول کافی نیست.', 402, 'INSUFFICIENT_FUNDS');
  }

  await tx.wallet.update({
    where: { id: walletId },
    data: { balance: balanceAfter, version: { increment: 1 } },
  });

  const record = await tx.walletTransaction.create({
    data: {
      walletId,
      userId: input.userId,
      type: input.type,
      status: 'SUCCESS',
      amount: input.amount,
      balanceBefore,
      balanceAfter,
      description: input.description,
      referenceKey: input.referenceKey,
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      registrationId: input.registrationId,
      storeOrderId: input.storeOrderId,
      performedBy: input.performedBy,
      metadata: input.metadata,
    },
  });

  return { balance: balanceAfter, transactionId: record.id };
}

/** نسخه‌ی مستقل — تراکنش خودش را باز می‌کند */
export async function mutateWalletStandalone(input: WalletMutation) {
  return prisma.$transaction((tx) => mutateWallet(tx, input), {
    isolationLevel: 'ReadCommitted',
    timeout: 15_000,
  });
}

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (wallet) return wallet;
  return prisma.wallet.create({ data: { userId } });
}

export async function getBalance(userId: string): Promise<bigint> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return wallet?.balance ?? 0n;
}
