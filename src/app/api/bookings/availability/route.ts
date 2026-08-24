import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { getCourtAvailability } from '@/lib/booking';
import { handleApiError, ok } from '@/lib/api';
import { availabilityQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * وضعیت سانس‌های یک روز.
 *
 * جریان رزرو ابتدا تاریخ و سپس ساعت را می‌پرسد، بنابراین پاسخ برای همه‌ی
 * زمین‌های فعال برگردانده می‌شود تا بتوان برای هر ساعت نشان داد کدام زمین‌ها
 * آزادند — بدون رفت‌وبرگشت اضافی به سرور.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const input = availabilityQuerySchema.parse({
      date: searchParams.get('date') ?? '',
      courtId: searchParams.get('courtId') ?? undefined,
    });

    const courts = await prisma.court.findMany({
      where: { isActive: true, ...(input.courtId ? { id: input.courtId } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { pricingRules: { where: { isActive: true } } },
    });

    const availability = await Promise.all(
      courts.map((court) => getCourtAvailability(court, input.date, user.id)),
    );

    return ok({ date: input.date, courts: availability });
  } catch (error) {
    return handleApiError(error);
  }
}
