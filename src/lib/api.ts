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
  }

  console.error('[api] unhandled error:', error);
  return fail('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.', 500);
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}
