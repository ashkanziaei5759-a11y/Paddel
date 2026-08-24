import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { cancelOrder } from '@/lib/store';
import { notify } from '@/lib/notifications';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({ status: z.enum(['PENDING', 'READY', 'DELIVERED', 'CANCELLED']) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { status } = schema.parse(await req.json());

    if (status === 'CANCELLED') {
      await cancelOrder(id, admin.id, true);
      return ok({ status });
    }

    const order = await prisma.storeOrder.update({ where: { id }, data: { status } });

    if (status === 'READY') {
      await notify({
        userId: order.userId,
        type: 'GENERAL',
        title: 'سفارش شما آماده‌ی تحویل است',
        body: `سفارش ${order.code} در باشگاه آماده است.`,
        actionUrl: '/market/orders',
      });
    }

    return ok({ status });
  } catch (error) {
    return handleApiError(error);
  }
}
