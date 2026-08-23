import 'server-only';
import { randomInt } from 'node:crypto';
import type { OtpPurpose, Prisma } from '@prisma/client';
import { prisma } from './db';
import { hashOtp, verifyOtp } from './auth/password';
import { AppError } from './api';
import { toFaDigits } from './datetime';

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 5);
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 120);
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, '0');
}

/**
 * ارسال پیامک — پیاده‌سازی قابل تعویض.
 * در حالت توسعه کد فقط در کنسول سرور چاپ می‌شود.
 */
async function deliverSms(phone: string, code: string): Promise<void> {
  const provider = process.env.OTP_PROVIDER || 'console';

  if (provider === 'kavenegar' && process.env.KAVENEGAR_API_KEY) {
    const url =
      `https://api.kavenegar.com/v1/${process.env.KAVENEGAR_API_KEY}/verify/lookup.json` +
      `?receptor=${encodeURIComponent(phone)}&token=${encodeURIComponent(code)}` +
      `&template=${encodeURIComponent(process.env.KAVENEGAR_TEMPLATE || 'persian-padel-otp')}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new AppError('ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید.', 502);
    return;
  }

  console.info(`\n[OTP] کد تأیید برای ${phone}: ${code}  (اعتبار: ${OTP_TTL_SECONDS} ثانیه)\n`);
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
