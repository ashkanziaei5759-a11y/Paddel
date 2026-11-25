import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { AppError, clientIp, fail, handleApiError, ok } from '@/lib/api';
import { signupSchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';

export const runtime = 'nodejs';

/**
 * ثبت‌نام بازیکن با نام کاربری و رمز عبور — بدون کد پیامکی.
 * حساب، پروفایل و کیف پول در یک تراکنش ساخته می‌شود و کاربر وارد می‌شود.
 * شماره‌ی موبایل اختیاری است و تأیید نمی‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await rateLimit(`signup:${ip}`, RATE_LIMITS.SIGNUP.limit, RATE_LIMITS.SIGNUP.window);
    if (!limited.allowed) {
      return fail('تعداد درخواست‌های شما زیاد است. لطفاً کمی بعد تلاش کنید.', 429);
    }

    const input = signupSchema.parse(await req.json());

    const [existingUsername, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }),
      input.phone
        ? prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } })
        : null,
    ]);
    if (existingUsername) throw new AppError('این نام کاربری قبلاً انتخاب شده است.', 409);
    if (existingPhone) throw new AppError('این شماره موبایل قبلاً ثبت شده است.', 409);

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        phone: input.phone ?? null,
        role: 'PLAYER',
        profile: { create: { firstName: input.firstName, lastName: input.lastName } },
        wallet: { create: {} },
      },
    });

    await createSession(user.id, user.role, { userAgent: req.headers.get('user-agent'), ip });

    await notify({
      userId: user.id,
      type: 'GENERAL',
      title: 'به پرشین پدل خوش آمدید 🎾',
      body: 'حساب شما ساخته شد. برای شروع، کیف پول خود را شارژ کنید و اولین زمین را رزرو کنید.',
      actionUrl: '/booking',
    });

    return ok({ userId: user.id, username: user.username });
  } catch (error) {
    return handleApiError(error);
  }
}
