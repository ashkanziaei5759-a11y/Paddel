import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { pricingRuleSchema } from '@/lib/validation';
import { tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = pricingRuleSchema.parse(body);

    const court = await prisma.court.findUnique({ where: { id }, select: { id: true } });
    if (!court) throw new AppError('زمین یافت نشد.', 404);

    const rule = await prisma.courtPricingRule.create({
      data: {
        courtId: id,
        name: input.name,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        daysOfWeek: input.daysOfWeek,
        price: tomanToRial(input.priceToman),
        priority: input.priority,
        isActive: input.isActive,
      },
    });

    return ok({ id: rule.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
