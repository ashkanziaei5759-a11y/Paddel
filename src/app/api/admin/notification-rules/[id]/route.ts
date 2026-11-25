import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { tomanToRial } from '@/lib/utils';
import { notificationRuleSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/** ویرایش قانون، یا فقط روشن/خاموش کردنش با { isActive } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await prisma.notificationRule.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new AppError('قانون پیدا نشد.', 404);

    if (Object.keys(body).length === 1 && typeof body.isActive === 'boolean') {
      await prisma.notificationRule.update({ where: { id }, data: { isActive: body.isActive } });
      return ok({ updated: true });
    }

    const input = notificationRuleSchema.parse(body);
    await prisma.notificationRule.update({
      where: { id },
      data: {
        name: input.name,
        trigger: input.trigger,
        offset: input.offset,
        thresholdAmount: input.trigger === 'LOW_WALLET' && input.thresholdToman ? tomanToRial(input.thresholdToman) : null,
        runAt: input.trigger === 'SCHEDULED' && input.runAt ? new Date(input.runAt) : null,
        /* زمان‌دارِ ویرایش‌شده دوباره منتظر اجرا می‌ماند */
        ...(input.trigger === 'SCHEDULED' ? { lastRunAt: null } : {}),
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive,
      },
    });
    return ok({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await prisma.notificationRule.deleteMany({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
