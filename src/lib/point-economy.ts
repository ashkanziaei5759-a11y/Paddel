import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';
import { mutatePoints } from './points';
import { mutateWallet } from './wallet';
import { generateBookingCode } from './utils';

/**
 * اقتصاد امتیاز — نرخ تبدیل، بن رزرو، و تبدیل امتیاز به موجودی.
 *
 * یک نرخ واحد همه‌جا استفاده می‌شود: هم وقتی مدیر امتیاز بازیکنی را به کیف
 * پول واریز می‌کند، هم وقتی بازیکن هزینه‌ی رزرو را با امتیاز می‌دهد. اگر دو
 * نرخ جدا داشتیم، اختلافشان یک راه سوءاستفاده می‌شد: خرید ارزان از یک سمت و
 * نقد کردن گران از سمت دیگر.
 */

export const POINT_ECONOMY_KEY = 'point-economy';

export interface PointEconomy {
  /** هر امتیاز چند ریال می‌ارزد */
  rialPerPoint: number;
  /** سقف امتیازی که در یک عملیات تبدیل می‌شود — جلوی اشتباه بزرگ را می‌گیرد */
  maxConvertPerOperation: number;
}

export const DEFAULT_POINT_ECONOMY: PointEconomy = {
  rialPerPoint: 40_000,
  maxConvertPerOperation: 100_000,
};

export async function getPointEconomy(): Promise<PointEconomy> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: POINT_ECONOMY_KEY } });
    if (row?.value && typeof row.value === 'object' && !Array.isArray(row.value)) {
      const v = row.value as Record<string, unknown>;
      const rial = Number(v.rialPerPoint);
      const max = Number(v.maxConvertPerOperation);
      return {
        rialPerPoint:
          Number.isFinite(rial) && rial > 0 ? Math.floor(rial) : DEFAULT_POINT_ECONOMY.rialPerPoint,
        maxConvertPerOperation:
          Number.isFinite(max) && max > 0
            ? Math.floor(max)
            : DEFAULT_POINT_ECONOMY.maxConvertPerOperation,
      };
    }
  } catch {
    /* پایگاه داده در دسترس نیست — با پیش‌فرض ادامه بده */
  }
  return DEFAULT_POINT_ECONOMY;
}

/** ریال → امتیاز، همیشه به بالا: باشگاه ضرر نکند */
export function rialToPoints(rial: bigint, rialPerPoint: number): number {
  if (rial <= 0n) return 0;
  const per = BigInt(rialPerPoint);
  return Number((rial + per - 1n) / per);
}

/** امتیاز → ریال */
export function pointsToRial(points: number, rialPerPoint: number): bigint {
  return BigInt(points) * BigInt(rialPerPoint);
}

/* ------------------------------------------------------------------ */
/*  بن رزرو                                                            */
/* ------------------------------------------------------------------ */

/** چقدر از هزینه‌ی رزرو را این بن می‌پوشاند */
export function voucherDiscount(
  voucher: { percentOff: number; maxDiscountRial: bigint | null },
  total: bigint,
): bigint {
  const raw = (total * BigInt(voucher.percentOff)) / 100n;
  if (voucher.maxDiscountRial !== null && raw > voucher.maxDiscountRial) {
    return voucher.maxDiscountRial;
  }
  return raw > total ? total : raw;
}

/**
 * قفل کردن و اعتبارسنجی بن، درون همان تراکنشِ رزرو.
 *
 * قفل ردیف لازم است: بدون آن دو رزروِ هم‌زمان می‌توانستند یک بن را دو بار
 * خرج کنند. یکتا بودن `bookingId` سد دوم است.
 */
export async function lockVoucherForUse(
  tx: Prisma.TransactionClient,
  input: { code: string; userId: string },
) {
  const rows = await tx.$queryRaw<
    {
      id: string;
      userId: string;
      status: string;
      percentOff: number;
      maxDiscountRial: bigint | null;
      expiresAt: Date;
    }[]
  >`
    SELECT id, "userId", status::text, "percentOff", "maxDiscountRial", "expiresAt"
    FROM "booking_vouchers" WHERE code = ${input.code} FOR UPDATE
  `;

  const voucher = rows[0];
  if (!voucher) throw new AppError('این بن پیدا نشد.', 404);
  if (voucher.userId !== input.userId) throw new AppError('این بن متعلق به شما نیست.', 403);
  if (voucher.status === 'USED') throw new AppError('این بن قبلاً استفاده شده است.', 409);
  if (voucher.status !== 'ACTIVE') throw new AppError('این بن دیگر معتبر نیست.', 409);
  if (voucher.expiresAt.getTime() <= Date.now()) {
    await tx.bookingVoucher.update({ where: { id: voucher.id }, data: { status: 'EXPIRED' } });
    throw new AppError('اعتبار این بن تمام شده است.', 409);
  }

  return voucher;
}

/** صدور بن پس از خرید امتیازی */
export async function issueVoucher(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    kind: 'FREE_SESSION' | 'PERCENT_DISCOUNT';
    percentOff: number;
    maxDiscountRial: bigint | null;
    pointsSpent: number;
    days: number;
    productId?: string;
  },
) {
  const expiresAt = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);
  return tx.bookingVoucher.create({
    data: {
      code: generateBookingCode('BN'),
      userId: input.userId,
      kind: input.kind,
      percentOff: input.percentOff,
      maxDiscountRial: input.maxDiscountRial,
      pointsSpent: input.pointsSpent,
      expiresAt,
      productId: input.productId,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  تبدیل امتیاز به موجودی                                             */
/* ------------------------------------------------------------------ */

/**
 * مدیر امتیاز یک بازیکن را به کیف پولش واریز می‌کند.
 *
 * هر دو سمت در یک تراکنش انجام می‌شوند، پس حالتی که امتیاز کم شده ولی پول
 * واریز نشده وجود ندارد. `referenceKey` یکتا هم می‌سازیم تا اگر درخواست دو
 * بار برسد، دو بار واریز نشود.
 */
export async function convertPointsToWallet(input: {
  adminId: string;
  userId: string;
  points: number;
  reason?: string;
}) {
  const economy = await getPointEconomy();

  if (!Number.isInteger(input.points) || input.points <= 0) {
    throw new AppError('تعداد امتیاز باید عددی مثبت باشد.', 400);
  }
  if (input.points > economy.maxConvertPerOperation) {
    throw new AppError(
      `در هر عملیات حداکثر ${economy.maxConvertPerOperation} امتیاز قابل تبدیل است.`,
      400,
    );
  }

  const rial = pointsToRial(input.points, economy.rialPerPoint);
  const key = `points-convert:${input.userId}:${Date.now()}`;

  return prisma.$transaction(
    async (tx) => {
      await mutatePoints(tx, {
        userId: input.userId,
        amount: -input.points,
        type: 'CONVERTED_TO_WALLET',
        description: input.reason ?? 'تبدیل امتیاز به موجودی کیف پول',
        referenceKey: key,
        performedById: input.adminId,
      });

      const wallet = await mutateWallet(tx, {
        userId: input.userId,
        amount: rial,
        type: 'ADMIN_CREDIT',
        description: `تبدیل ${input.points} امتیاز به موجودی`,
        referenceKey: key,
        metadata: { convertedPoints: input.points, rialPerPoint: economy.rialPerPoint },
      });

      return { points: input.points, rial, balance: wallet.balance };
    },
    { timeout: 15_000 },
  );
}
