import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { issueOtp } from '@/lib/otp';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { AppError, fail, handleApiError, ok } from '@/lib/api';
import { resendOtpSchema } from '@/lib/validation';
import { toFaDigits } from '@/lib/datetime';

export const runtime = 'nodejs';

/** ارسال مجدد کد بر اساس درخواست قبلی — بدون نیاز به ارسال دوباره‌ی اطلاعات */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = resendOtpSchema.parse(body);

    const previous = await prisma.phoneVerification.findUnique({
      where: { id: input.verificationId },
    });
    if (!previous) throw new AppError('درخواست تأیید یافت نشد.', 404);

    // پنجره‌ی امن: تا ۳۰ دقیقه پس از درخواست اولیه
    if (Date.now() - previous.createdAt.getTime() > 30 * 60_000) {
      throw new AppError('این درخواست منقضی شده است. لطفاً از ابتدا شروع کنید.', 410);
    }

    const limited = await rateLimit(
      `otp:${previous.phone}`,
      RATE_LIMITS.OTP_REQUEST.limit,
      RATE_LIMITS.OTP_REQUEST.window,
    );
    if (!limited.allowed) {
      return fail(
        `درخواست کد بیش از حد مجاز است. ${toFaDigits(limited.retryAfterSeconds)} ثانیه دیگر تلاش کنید.`,
        429,
      );
    }

    const result = await issueOtp({
      phone: previous.phone,
      purpose: previous.purpose,
      userId: previous.userId ?? undefined,
      payload: (previous.payload ?? undefined) as never,
    });

    return ok({
      verificationId: result.verificationId,
      expiresAt: result.expiresAt,
      devCode: result.devCode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
