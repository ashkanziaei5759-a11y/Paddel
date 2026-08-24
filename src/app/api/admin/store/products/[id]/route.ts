import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { storeProductSchema } from '@/lib/validation';
import { tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const input = storeProductSchema.parse(await req.json());

    await prisma.storeProduct.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        category: input.category,
        pricePoints: input.pricePoints || null,
        priceRial: input.priceToman ? tomanToRial(input.priceToman) : null,
        stock: input.stock,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

/** کالای فروخته‌شده حذف نمی‌شود تا سوابق سفارش‌ها سالم بماند — غیرفعال می‌شود */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const sold = await prisma.storeOrderItem.count({ where: { productId: id } });
    if (sold > 0) {
      await prisma.storeProduct.update({ where: { id }, data: { isActive: false, stock: 0 } });
      return ok({ deleted: false, deactivated: true });
    }

    await prisma.storeProduct.delete({ where: { id } });
    return ok({ deleted: true, deactivated: false });
  } catch (error) {
    return handleApiError(error);
  }
}
