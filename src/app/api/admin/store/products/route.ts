import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { storeProductSchema } from '@/lib/validation';
import { slugify, tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const products = await prisma.storeProduct.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return ok({ products });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const input = storeProductSchema.parse(await req.json());

    let slug = slugify(input.name);
    if (await prisma.storeProduct.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const product = await prisma.storeProduct.create({
      data: {
        name: input.name,
        slug,
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

    return ok({ id: product.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
