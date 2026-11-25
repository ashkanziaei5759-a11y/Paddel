import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { tomanToRial } from '@/lib/utils';
import { notificationRuleSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ساخت قانون اعلان خودکار */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = notificationRuleSchema.parse(await req.json());

    const rule = await prisma.notificationRule.create({
      data: {
        name: input.name,
        trigger: input.trigger,
        offset: input.offset,
        thresholdAmount: input.trigger === 'LOW_WALLET' && input.thresholdToman ? tomanToRial(input.thresholdToman) : null,
        runAt: input.trigger === 'SCHEDULED' && input.runAt ? new Date(input.runAt) : null,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive,
        createdById: admin.id,
      },
      select: { id: true },
    });
    return ok({ rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
