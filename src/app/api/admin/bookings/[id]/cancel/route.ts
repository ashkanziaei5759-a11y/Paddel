import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { cancelBooking } from '@/lib/cancellation';
import { handleApiError, ok } from '@/lib/api';
import { tomanToRial } from '@/lib/utils';

export const runtime = 'nodejs';

const schema = z.object({
  reason: z.string().trim().max(240).optional(),
  overrideRefundToman: z.coerce.number().int().min(0).optional(),
  adjustmentNote: z.string().trim().max(240).optional(),
});

/** لغو رزرو توسط مدیر — با امکان تعیین دستی مبلغ بازگشتی */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const input = schema.parse(body);

    const result = await cancelBooking({
      bookingId: id,
      cancelledBy: admin.id,
      cancelledRole: 'ADMIN',
      reason: input.reason,
      overrideRefundAmount:
        input.overrideRefundToman !== undefined ? tomanToRial(input.overrideRefundToman) : undefined,
      adjustmentNote: input.adjustmentNote,
    });

    return ok({
      refundAmount: result.refundAmount,
      penaltyAmount: result.penaltyAmount,
      penaltyPercent: result.penaltyPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
