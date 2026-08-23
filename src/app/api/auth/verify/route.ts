import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { consumeOtp } from '@/lib/otp';
import { createSession } from '@/lib/auth/session';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { AppError, clientIp, fail, handleApiError, ok } from '@/lib/api';
import { signupVerifySchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';

export const runtime = 'nodejs';

interface SignupPayload {
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

function parsePayload(value: unknown): SignupPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Record<string, unknown>;
  if (
    typeof r.username !== 'string' ||
    typeof r.passwordHash !== 'string' ||
    typeof r.firstName !== 'string' ||
    typeof r.lastName !== 'string'
  ) {
    return null;
  }
  return {
    username: r.username,
    passwordHash: r.passwordHash,
    firstName: r.firstName,
    lastName: r.lastName,
  };
}

/** گام دو: تأیید کد و ساخت حساب + کیف پول + پروفایل در یک تراکنش */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await rateLimit(
      `otp-verify:${ip}`,
      RATE_LIMITS.OTP_VERIFY.limit,
      RATE_LIMITS.OTP_VERIFY.window,
    );
    if (!limited.allowed) return fail('تعداد تلاش‌های شما زیاد است. کمی بعد تلاش کنید.', 429);

    const body = await req.json();
    const input = signupVerifySchema.parse(body);

    const consumed = await consumeOtp(input.verificationId, input.code);

    // ---- تغییر شماره‌ی کاربر موجود ----
    if (consumed.purpose === 'PHONE_CHANGE' && consumed.userId) {
      const taken = await prisma.user.findFirst({
        where: { phone: consumed.phone, NOT: { id: consumed.userId } },
        select: { id: true },
      });
      if (taken) throw new AppError('این شماره موبایل به حساب دیگری متصل است.', 409);

      await prisma.user.update({
        where: { id: consumed.userId },
        data: { phone: consumed.phone, phoneVerifiedAt: new Date() },
      });
      return ok({ mode: 'PHONE_CHANGE', phone: consumed.phone });
    }

    // ---- تکمیل ثبت‌نام ----
    const payload = parsePayload(consumed.payload);
    if (!payload) throw new AppError('اطلاعات ثبت‌نام نامعتبر است. لطفاً دوباره ثبت‌نام کنید.', 400);

    const [usernameTaken, phoneTaken] = await Promise.all([
      prisma.user.findUnique({ where: { username: payload.username }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone: consumed.phone }, select: { id: true } }),
    ]);
    if (usernameTaken) throw new AppError('این نام کاربری در این فاصله ثبت شد. نام دیگری انتخاب کنید.', 409);
    if (phoneTaken) throw new AppError('این شماره موبایل قبلاً ثبت شده است.', 409);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: payload.username,
          passwordHash: payload.passwordHash,
          phone: consumed.phone,
          phoneVerifiedAt: new Date(),
          role: 'PLAYER',
          profile: {
            create: { firstName: payload.firstName, lastName: payload.lastName },
          },
          wallet: { create: {} },
        },
      });
      return created;
    });

    await createSession(user.id, user.role, {
      userAgent: req.headers.get('user-agent'),
      ip,
    });

    await notify({
      userId: user.id,
      type: 'GENERAL',
      title: 'به پرشین پدل خوش آمدید 🎾',
      body: 'حساب شما ساخته شد. برای شروع، کیف پول خود را شارژ کنید و اولین زمین را رزرو کنید.',
      actionUrl: '/booking',
    });

    return ok({ mode: 'SIGNUP', userId: user.id, username: user.username });
  } catch (error) {
    return handleApiError(error);
  }
}
