import 'server-only';
import { randomInt } from 'node:crypto';
import type { OtpPurpose, Prisma } from '@prisma/client';
import { prisma } from './db';
import { hashOtp, verifyOtp } from './auth/password';
import { AppError } from './api';
import { SmsError, getSmsProvider } from './sms';
import { toFaDigits } from './datetime';

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 5);
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 120);
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, '0');
}

/**
 * ارسال کد تأیید از طریق سرویس پیامک پیکربندی‌شده.
 * در حالت توسعه (OTP_PROVIDER=console) کد فقط در کنسول سرور چاپ می‌شود.
 */
async function deliverSms(phone: string, code: string): Promise<void> {
  const provider = getSmsProvider();

  try {
    await provider.sendOtp(phone, code);
  } catch (error) {
    if (error instanceof SmsError) {
      console.error(`[otp] ارسال پیامک با «${error.provider}» ناموفق بود:`, error.message);
      throw new AppError('ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید.', 502);
    }
    throw error;
  }
}

export interface IssueOtpInput {
  phone: string;
  purpose: OtpPurpose;
  userId?: string;
  payload?: Prisma.InputJsonValue;
}

export interface IssueOtpResult {
  verificationId: string;
  expiresAt: Date;
  /** فقط در حالت توسعه پر می‌شود تا تست دستی ساده باشد */
  devCode?: string;
}

export async function issueOtp(input: IssueOtpInput): Promise<IssueOtpResult> {
  // ابطال کدهای قبلیِ همان شماره و همان هدف
  await prisma.phoneVerification.updateMany({
    where: { phone: input.phone, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  const record = await prisma.phoneVerification.create({
    data: {
      phone: input.phone,
      purpose: input.purpose,
      userId: input.userId,
      payload: input.payload,
      codeHash: await hashOtp(code),
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
    },
  });

  await deliverSms(input.phone, code);

  return {
    verificationId: record.id,
    expiresAt,
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
  };
}

export interface ConsumeOtpResult {
  phone: string;
  purpose: OtpPurpose;
  userId: string | null;
  payload: Prisma.JsonValue | null;
}

/** بررسی و مصرف کد — هر کد فقط یک بار قابل استفاده است */
export async function consumeOtp(verificationId: string, code: string): Promise<ConsumeOtpResult> {
  const record = await prisma.phoneVerification.findUnique({ where: { id: verificationId } });

  if (!record) throw new AppError('درخواست تأیید یافت نشد. لطفاً دوباره کد دریافت کنید.', 404);
  if (record.consumedAt) throw new AppError('این کد قبلاً استفاده شده است.', 410);
  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError('کد تأیید منقضی شده است. لطفاً کد جدید دریافت کنید.', 410);
  }
  if (record.attempts >= record.maxAttempts) {
    throw new AppError('تعداد تلاش‌های مجاز به پایان رسید. لطفاً کد جدید دریافت کنید.', 429);
  }

  const valid = await verifyOtp(code, record.codeHash);

  if (!valid) {
    const updated = await prisma.phoneVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const left = Math.max(0, updated.maxAttempts - updated.attempts);
    throw new AppError(
      left > 0
        ? `کد تأیید نادرست است. ${toFaDigits(left)} تلاش دیگر باقی مانده است.`
        : 'کد تأیید نادرست است.',
      400,
    );
  }

  await prisma.phoneVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return {
    phone: record.phone,
    purpose: record.purpose,
    userId: record.userId,
    payload: record.payload,
  };
}

export const OTP_CONFIG = { length: OTP_LENGTH, ttlSeconds: OTP_TTL_SECONDS };
