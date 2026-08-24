import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { purchase } from '@/lib/store';
import { handleApiError, ok } from '@/lib/api';
import { storePurchaseSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireUser();
    const products = await prisma.storeProduct.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return ok({ products });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = storePurchaseSchema.parse(body);

    const order = await purchase({
      userId: user.id,
      productId: input.productId,
      quantity: input.quantity,
      method: input.method,
    });

    return ok({ id: order.id, code: order.code }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
