import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { courtSchema } from '@/lib/validation';
import { slugify, tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const courts = await prisma.court.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { pricingRules: true },
    });
    return ok({ courts });
  } catch (error) {
    return handleApiError(error);
  }
}

/** ایجاد زمین جدید — سیستم به تعداد ثابتی زمین محدود نیست */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const input = courtSchema.parse(body);

    let slug = slugify(input.name);
    const existing = await prisma.court.findUnique({ where: { slug }, select: { id: true } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const maxOrder = await prisma.court.aggregate({ _max: { sortOrder: true } });

    const court = await prisma.court.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive ?? true,
        basePrice: tomanToRial(input.basePriceToman),
        slotDurationMinutes: input.slotDurationMinutes,
        openingMinute: input.openingMinute,
        closingMinute: input.closingMinute,
        maxConsecutiveSlots: input.maxConsecutiveSlots,
        minLeadTimeMinutes: input.minLeadTimeMinutes,
        advanceBookingDays: input.advanceBookingDays,
        sortOrder: input.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return ok({ id: court.id, slug: court.slug }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
