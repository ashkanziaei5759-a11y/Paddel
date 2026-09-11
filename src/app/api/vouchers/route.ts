import { requireUser } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * بن‌های رزرو کاربر.
 *
 * بن‌هایی که تاریخشان گذشته اما هنوز ACTIVE مانده‌اند، همین‌جا منقضی
 * علامت می‌خورند — بدون این، بنِ سوخته تا اولین تلاش برای استفاده در
 * فهرست «قابل استفاده» می‌ماند و کاربر را گمراه می‌کند.
 */
export async function GET() {
  try {
    const user = await requireUser();

    await prisma.bookingVoucher.updateMany({
      where: { userId: user.id, status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });

    const vouchers = await prisma.bookingVoucher.findMany({
      where: { userId: user.id },
      orderBy: [{ status: 'asc' }, { expiresAt: 'asc' }],
      take: 50,
      select: {
        id: true,
        code: true,
        kind: true,
        percentOff: true,
        maxDiscountRial: true,
        scope: true,
        status: true,
        expiresAt: true,
        usedAt: true,
        giftedAt: true,
        giftedFrom: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    return ok({
      vouchers: vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        kind: v.kind,
        percentOff: v.percentOff,
        maxDiscountRial: v.maxDiscountRial ? v.maxDiscountRial.toString() : null,
        scope: v.scope,
        status: v.status,
        expiresAt: v.expiresAt.toISOString(),
        usedAt: v.usedAt ? v.usedAt.toISOString() : null,
        giftedFrom: v.giftedFrom
          ? `${v.giftedFrom.profile?.firstName ?? ''} ${v.giftedFrom.profile?.lastName ?? ''}`.trim()
          : null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
