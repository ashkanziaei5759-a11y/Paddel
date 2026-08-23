import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, revokeAllSessions } from '@/lib/auth/session';
import { AppError, clientIp, handleApiError, ok } from '@/lib/api';
import { changePasswordSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = changePasswordSchema.parse(body);

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record) throw new AppError('کاربر یافت نشد.', 404);

    const valid = await verifyPassword(input.currentPassword, record.passwordHash);
    if (!valid) throw new AppError('رمز عبور فعلی نادرست است.', 401);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });

    // ابطال همه‌ی نشست‌ها و صدور نشست تازه برای دستگاه جاری
    await revokeAllSessions(user.id);
    await createSession(user.id, user.role, {
      userAgent: req.headers.get('user-agent'),
      ip: clientIp(req),
    });

    return ok({ changed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
