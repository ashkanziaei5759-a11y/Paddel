import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';
import { AppError, handleApiError, ok } from '@/lib/api';
import { zPassword } from '@/lib/validation';

export const runtime = 'nodejs';

const schema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  password: zPassword.optional(),
});

/** غیرفعال/فعال کردن ادمین پذیرش یا تعیین رمز تازه */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const input = schema.parse(await req.json());

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target || target.role !== 'STAFF') throw new AppError('ادمین پذیرش پیدا نشد.', 404);

    await prisma.user.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.password ? { passwordHash: await hashPassword(input.password), failedLoginCount: 0, lockedUntil: null } : {}),
      },
    });

    /* غیرفعال شدن یا عوض شدن رمز: همه‌ی دستگاه‌هایش فوراً خارج شوند */
    if (input.status === 'SUSPENDED' || input.password) await revokeAllSessions(id);

    return ok({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
