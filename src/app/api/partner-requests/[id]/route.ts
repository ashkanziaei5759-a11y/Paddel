import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { notify } from '@/lib/notifications';

export const runtime = 'nodejs';

/** لغو درخواست پارتنری توسط ارسال‌کننده — پیش از پاسخ گیرنده */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const request = await prisma.partnerRequest.findUnique({
      where: { id },
      include: { sender: { include: { profile: true } } },
    });

    if (!request) throw new AppError('درخواست یافت نشد.', 404);
    if (request.senderId !== user.id) throw new AppError('این درخواست متعلق به شما نیست.', 403);
    if (request.status !== 'PENDING') throw new AppError('این درخواست قبلاً پاسخ داده شده است.', 409);

    const updated = await prisma.partnerRequest.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });

    await notify({
      userId: request.receiverId,
      type: 'PARTNER_REJECTED',
      title: 'درخواست پارتنری لغو شد',
      body: `${request.sender.profile?.firstName ?? ''} ${request.sender.profile?.lastName ?? ''} درخواست خود را لغو کرد.`.trim(),
      actionUrl: '/partner-requests',
    });

    return ok({ status: updated.status });
  } catch (error) {
    return handleApiError(error);
  }
}
