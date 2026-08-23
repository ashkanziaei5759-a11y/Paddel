import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';
import { notify } from '@/lib/notifications';
import { AppError, handleApiError, ok } from '@/lib/api';
import { adminUpdateUserSchema } from '@/lib/validation';
import { LEVEL_LABEL } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true, wallet: true },
    });
    if (!user) throw new AppError('کاربر یافت نشد.', 404);

    return ok({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = adminUpdateUserSchema.parse(body);

    const before = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!before || !before.profile) throw new AppError('کاربر یافت نشد.', 404);

    // مدیر نمی‌تواند نقش یا وضعیت خودش را تغییر دهد — جلوگیری از قفل شدن سیستم
    if (id === admin.id && (input.role === 'PLAYER' || input.status === 'SUSPENDED')) {
      throw new AppError('نمی‌توانید دسترسی مدیریتی خودتان را حذف کنید.', 400);
    }

    if (input.phone && input.phone !== before.phone) {
      const taken = await prisma.user.findFirst({
        where: { phone: input.phone, NOT: { id } },
        select: { id: true },
      });
      if (taken) throw new AppError('این شماره موبایل به حساب دیگری متصل است.', 409);
    }

    const levelChanged = input.level && input.level !== before.profile.level;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.phone ? { phone: input.phone, phoneVerifiedAt: new Date() } : {}),
          ...(input.resetPassword
            ? { passwordHash: await hashPassword(input.resetPassword), failedLoginCount: 0, lockedUntil: null }
            : {}),
          profile: {
            update: {
              ...(input.firstName ? { firstName: input.firstName } : {}),
              ...(input.lastName ? { lastName: input.lastName } : {}),
              ...(input.level
                ? { level: input.level, levelUpdatedAt: new Date(), levelUpdatedBy: admin.id }
                : {}),
            },
          },
        },
        include: { profile: true },
      });

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: 'ADMIN_UPDATE_USER',
          entityType: 'User',
          entityId: id,
          before: {
            level: before.profile!.level,
            role: before.role,
            status: before.status,
          },
          after: { level: user.profile!.level, role: user.role, status: user.status },
        },
      });

      return user;
    });

    // تغییر رمز یا غیرفعال شدن → ابطال نشست‌ها
    if (input.resetPassword || input.status === 'SUSPENDED') {
      await revokeAllSessions(id);
    }

    if (levelChanged && input.level) {
      await notify({
        userId: id,
        type: 'LEVEL_CHANGED',
        title: 'سطح شما به‌روزرسانی شد 📈',
        body: `سطح بازیکنی شما توسط مدیریت باشگاه به ${LEVEL_LABEL[input.level]} تغییر کرد.`,
        actionUrl: '/profile',
      });
    }

    return ok({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
