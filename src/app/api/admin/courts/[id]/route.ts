import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { courtSchema } from '@/lib/validation';
import { tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = courtSchema.parse(body);

    const before = await prisma.court.findUnique({ where: { id } });
    if (!before) throw new AppError('زمین یافت نشد.', 404);

    const court = await prisma.court.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive ?? before.isActive,
        basePrice: tomanToRial(input.basePriceToman),
        slotDurationMinutes: input.slotDurationMinutes,
        openingMinute: input.openingMinute,
        closingMinute: input.closingMinute,
        maxConsecutiveSlots: input.maxConsecutiveSlots,
        minLeadTimeMinutes: input.minLeadTimeMinutes,
        advanceBookingDays: input.advanceBookingDays,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'ADMIN_UPDATE_COURT',
        entityType: 'Court',
        entityId: id,
        before: { name: before.name, basePrice: before.basePrice.toString(), isActive: before.isActive },
        after: { name: court.name, basePrice: court.basePrice.toString(), isActive: court.isActive },
      },
    });

    return ok({ id: court.id });
  } catch (error) {
    return handleApiError(error);
  }
}

/** حذف زمین فقط وقتی مجاز است که هیچ رزروی نداشته باشد؛ در غیر این صورت غیرفعال شود */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const bookingCount = await prisma.booking.count({ where: { courtId: id } });
    if (bookingCount > 0) {
      await prisma.court.update({ where: { id }, data: { isActive: false } });
      return ok({ deleted: false, deactivated: true });
    }

    await prisma.court.delete({ where: { id } });
    return ok({ deleted: true, deactivated: false });
  } catch (error) {
    return handleApiError(error);
  }
}
