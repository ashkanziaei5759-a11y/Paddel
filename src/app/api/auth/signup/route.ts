import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { issueOtp } from '@/lib/otp';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { AppError, clientIp, fail, handleApiError, ok } from '@/lib/api';
import { signupStartSchema } from '@/lib/validation';
import { toFaDigits } from '@/lib/datetime';

export const runtime = 'nodejs';

/**
 * گام یکِ ثبت‌نام: اعتبارسنجی، رزرو نام کاربری/شماره و ارسال کد تأیید.
 * حساب کاربری فقط پس از تأیید OTP ساخته می‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await rateLimit(`signup:${ip}`, RATE_LIMITS.SIGNUP.limit, RATE_LIMITS.SIGNUP.window);
    if (!limited.allowed) {
      return fail('تعداد درخواست‌های شما زیاد است. لطفاً کمی بعد تلاش کنید.', 429);
    }

    const body = await req.json();
    const input = signupStartSchema.parse(body);

    const [existingUsername, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
    ]);

    if (existingUsername) throw new AppError('این نام کاربری قبلاً انتخاب شده است.', 409);
    if (existingPhone) throw new AppError('این شماره موبایل قبلاً ثبت شده است.', 409);

    const otpLimited = await rateLimit(
      `otp:${input.phone}`,
      RATE_LIMITS.OTP_REQUEST.limit,
      RATE_LIMITS.OTP_REQUEST.window,
    );
    if (!otpLimited.allowed) {
      return fail(
        `درخواست کد بیش از حد مجاز است. ${toFaDigits(otpLimited.retryAfterSeconds)} ثانیه دیگر تلاش کنید.`,
        429,
      );
    }

    // رمز عبور پیش از تأیید OTP هش می‌شود تا هرگز به‌صورت خام ذخیره نشود
    const passwordHash = await hashPassword(input.password);

    const result = await issueOtp({
      phone: input.phone,
      purpose: 'SIGNUP',
      payload: {
        username: input.username,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    return ok({
      verificationId: result.verificationId,
      expiresAt: result.expiresAt,
      phone: input.phone,
      devCode: result.devCode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
