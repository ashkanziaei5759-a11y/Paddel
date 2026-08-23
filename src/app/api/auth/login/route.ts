import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { clientIp, fail, handleApiError, ok } from '@/lib/api';
import { toFaDigits } from '@/lib/datetime';
import { loginSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await rateLimit(`login:${ip}`, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.window);
    if (!limited.allowed) {
      return fail(
        `تلاش‌های ورود بیش از حد مجاز است. ${toFaDigits(limited.retryAfterSeconds)} ثانیه دیگر تلاش کنید.`,
        429,
      );
    }

    const body = await req.json();
    const input = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: { profile: true },
    });

    // پیام یکسان برای کاربر ناموجود و رمز اشتباه — جلوگیری از شمارش کاربران
    const GENERIC = 'نام کاربری یا رمز عبور نادرست است.';
    if (!user || !user.profile) return fail(GENERIC, 401);

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      return fail(`حساب شما موقتاً قفل شده است. ${toFaDigits(minutes)} دقیقه دیگر تلاش کنید.`, 423);
    }

    if (user.status === 'SUSPENDED') {
      return fail('حساب شما توسط مدیریت غیرفعال شده است. با باشگاه تماس بگیرید.', 403);
    }

    const valid = await verifyPassword(input.password, user.passwordHash);

    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil:
            failedCount >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      if (failedCount >= MAX_FAILED) {
        return fail(`به دلیل تلاش‌های ناموفق، حساب شما ${toFaDigits(LOCK_MINUTES)} دقیقه قفل شد.`, 423);
      }
      return fail(GENERIC, 401);
    }

    if (!user.phoneVerifiedAt) {
      return fail('شماره موبایل شما تأیید نشده است. لطفاً دوباره ثبت‌نام کنید.', 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await createSession(user.id, user.role, { userAgent: req.headers.get('user-agent'), ip });

    return ok({
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: `${user.profile.firstName} ${user.profile.lastName}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
