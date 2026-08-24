import 'server-only';
import type { StorePaymentMethod } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './api';
import { mutateWallet } from './wallet';
import { mutatePoints } from './points';
import { notify } from './notifications';
import { formatToman, generateBookingCode } from './utils';
import { toFaDigits } from './datetime';

export interface PurchaseInput {
  userId: string;
  productId: string;
  quantity: number;
  method: StorePaymentMethod;
}

/**
 * خرید از فروشگاه باشگاه.
 *
 * تمام مراحل درون یک تراکنش اتمیک انجام می‌شود: کسر موجودی انبار، کسر امتیاز یا
 * وجه، و ثبت سفارش. اگر هر مرحله شکست بخورد هیچ‌کدام اعمال نمی‌شوند.
 * ردیف کالا با `SELECT … FOR UPDATE` قفل می‌شود تا دو خرید هم‌زمان، موجودی را
 * منفی نکنند.
 */
export async function purchase(input: PurchaseInput) {
  if (input.quantity < 1 || input.quantity > 10) {
    throw new AppError('تعداد انتخابی معتبر نیست.');
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; stock: number; isActive: boolean }[]
      >`SELECT id, stock, "isActive" FROM "store_products" WHERE id = ${input.productId} FOR UPDATE`;

      if (locked.length === 0) throw new AppError('کالا یافت نشد.', 404);

      const product = await tx.storeProduct.findUniqueOrThrow({ where: { id: input.productId } });

      if (!product.isActive) throw new AppError('این کالا در حال حاضر موجود نیست.', 409);
      if (locked[0].stock < input.quantity) {
        throw new AppError(
          locked[0].stock === 0
            ? 'موجودی این کالا به پایان رسیده است.'
            : `تنها ${toFaDigits(locked[0].stock)} عدد از این کالا موجود است.`,
          409,
        );
      }

      const usePoints = input.method === 'POINTS';
      if (usePoints && product.pricePoints == null) {
        throw new AppError('این کالا با امتیاز قابل خرید نیست.', 409);
      }
      if (!usePoints && product.priceRial == null) {
        throw new AppError('این کالا با کیف پول قابل خرید نیست.', 409);
      }

      const totalPoints = usePoints ? product.pricePoints! * input.quantity : 0;
      const totalRial = usePoints ? 0n : product.priceRial! * BigInt(input.quantity);

      const order = await tx.storeOrder.create({
        data: {
          code: generateBookingCode().replace('PP-', 'ST-'),
          userId: input.userId,
          method: input.method,
          status: 'PENDING',
          totalPoints,
          totalRial,
          items: {
            create: {
              productId: product.id,
              nameSnapshot: product.name,
              quantity: input.quantity,
              pointsEach: product.pricePoints ?? 0,
              rialEach: product.priceRial ?? 0n,
            },
          },
        },
      });

      await tx.storeProduct.update({
        where: { id: product.id },
        data: { stock: { decrement: input.quantity } },
      });

      if (usePoints) {
        await mutatePoints(tx, {
          userId: input.userId,
          amount: -totalPoints,
          type: 'STORE_PURCHASE',
          description: `خرید ${product.name} از فروشگاه`,
          referenceKey: `store:${order.id}:points`,
          metadata: { orderId: order.id, productId: product.id },
        });
      } else {
        await mutateWallet(tx, {
          userId: input.userId,
          amount: -totalRial,
          type: 'STORE_PURCHASE',
          description: `خرید ${product.name} از فروشگاه`,
          referenceKey: `store:${order.id}:wallet`,
          storeOrderId: order.id,
          metadata: { orderId: order.id, productId: product.id },
        });
      }

      return { order, product, totalPoints, totalRial };
    },
    { isolationLevel: 'ReadCommitted', timeout: 20_000 },
  );

  const price =
    input.method === 'POINTS'
      ? `${toFaDigits(result.totalPoints)} امتیاز`
      : formatToman(result.totalRial);

  await notify({
    userId: input.userId,
    type: 'GENERAL',
    title: 'سفارش شما ثبت شد',
    body: `${result.product.name} — ${price}. برای تحویل به باشگاه مراجعه کنید.`,
    actionUrl: '/market/orders',
    data: { orderId: result.order.id },
  });

  return result.order;
}

/** لغو سفارش و بازگرداندن امتیاز یا وجه — فقط پیش از تحویل */
export async function cancelOrder(orderId: string, actorId: string, isAdmin: boolean) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.storeOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new AppError('سفارش یافت نشد.', 404);
    if (!isAdmin && order.userId !== actorId) {
      throw new AppError('این سفارش متعلق به شما نیست.', 403);
    }
    if (order.status === 'CANCELLED') throw new AppError('این سفارش قبلاً لغو شده است.', 409);
    if (order.status === 'DELIVERED') {
      throw new AppError('سفارش تحویل‌شده قابل لغو نیست.', 409);
    }

    await tx.storeOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });

    for (const item of order.items) {
      await tx.storeProduct.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    if (order.method === 'POINTS' && order.totalPoints > 0) {
      await mutatePoints(tx, {
        userId: order.userId,
        amount: order.totalPoints,
        type: 'STORE_REFUND',
        description: 'بازگشت امتیاز سفارش لغوشده',
        referenceKey: `store:${order.id}:points-refund`,
        performedById: actorId,
      });
    } else if (order.method === 'WALLET' && order.totalRial > 0n) {
      await mutateWallet(tx, {
        userId: order.userId,
        amount: order.totalRial,
        type: 'STORE_REFUND',
        description: 'بازگشت وجه سفارش لغوشده',
        referenceKey: `store:${order.id}:wallet-refund`,
        storeOrderId: order.id,
        performedBy: actorId,
      });
    }

    return order;
  }, { timeout: 20_000 });
}
