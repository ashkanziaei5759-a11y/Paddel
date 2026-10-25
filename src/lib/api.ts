import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth/rbac';
import { serialize } from './db';

export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data: serialize(data) }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** تبدیل خطاهای شناخته‌شده به پاسخ فارسی مناسب */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.errors[0];
    return fail(first?.message || 'اطلاعات ارسالی نامعتبر است.', 422, {
      issues: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  if (error instanceof AuthError) return fail(error.message, error.status);
  if (error instanceof AppError) return fail(error.message, error.status, { code: error.code });

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') return fail('این مقدار قبلاً ثبت شده است.', 409);
    if (code === 'P2025') return fail('مورد درخواستی یافت نشد.', 404);
    // P2024: اتصال آزاد به پایگاه داده نماند — P2028: تراکنش در زمان مقرر شروع نشد.
    // هر دو یعنی سرور لحظه‌ای زیر بار است، نه این‌که درخواست کاربر خراب باشد.
    if (code === 'P2024' || code === 'P2028') {
      console.warn('[api] database busy:', code);
      return fail('سرور در این لحظه شلوغ است. لطفاً چند ثانیه دیگر دوباره تلاش کنید.', 503);
    }
  }

  console.error('[api] unhandled error:', error);
  return fail('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.', 500);
}

/**
 * IP واقعی کاربر — برای محدودیت نرخ ورود، ثبت‌نام و کد تأیید.
 *
 * هدرهایی مثل X-Real-IP یا CF-Connecting-IP را خود کاربر هم می‌تواند بفرستد و
 * IIS آن‌ها را دست‌نخورده رد می‌کند؛ اگر به آن‌ها اعتماد کنیم، مهاجم با عوض‌کردن
 * هدر در هر درخواست، سقف ۱۰ تلاشِ ورود را دور می‌زند و رمزها را حدس می‌زند.
 *
 * پس فقط به «آخرین» مقدارِ X-Forwarded-For اعتماد می‌کنیم: آن را پروکسی خودمان
 * می‌گذارد (IIS کل هدر را با IP واقعی جایگزین می‌کند، nginx به انتهایش اضافه
 * می‌کند) و کاربر نمی‌تواند جعلش کند.
 *
 * اگر سایت پشت CDN (مثل ابرآروان یا Cloudflare) باشد، آخرین مقدار IP خود CDN
 * است؛ آن وقت نام هدری را که CDN می‌گذارد در TRUSTED_IP_HEADER بنویسید
 * (مثلاً cf-connecting-ip).
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) {
    const value = h.get(trusted)?.split(',')[0].trim();
    if (value) return value;
  }
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((v) => v.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return 'unknown';
}
