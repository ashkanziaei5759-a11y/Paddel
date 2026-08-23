import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { pricingRuleSchema } from '@/lib/validation';
import { tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    await requireAdmin();
    const { id, ruleId } = await ctx.params;
    const body = await req.json();
    const input = pricingRuleSchema.parse(body);

    const existing = await prisma.courtPricingRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.courtId !== id) throw new AppError('قانون قیمت‌گذاری یافت نشد.', 404);

    await prisma.courtPricingRule.update({
      where: { id: ruleId },
      data: {
        name: input.name,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        daysOfWeek: input.daysOfWeek,
        price: tomanToRial(input.priceToman),
        priority: input.priority,
        isActive: input.isActive,
      },
    });

    return ok({ id: ruleId });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    await requireAdmin();
    const { id, ruleId } = await ctx.params;

    const existing = await prisma.courtPricingRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.courtId !== id) throw new AppError('قانون قیمت‌گذاری یافت نشد.', 404);

    await prisma.courtPricingRule.delete({ where: { id: ruleId } });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
