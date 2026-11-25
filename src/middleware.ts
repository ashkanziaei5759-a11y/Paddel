import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * دسترسی ادمین پذیرش (STAFF) در پنل مدیریت.
 *
 * STAFF فقط رزرو تلفنی و فهرست رزروها را می‌بیند. این بررسی باید روی هر
 * درخواست انجام شود، چون layout پنل در جابه‌جایی داخل اپ دوباره اجرا نمی‌شود.
 * نقش از توکنِ امضاشده‌ی نشست خوانده می‌شود؛ بررسی کامل نشست (باطل‌شدن،
 * تعلیق حساب) همچنان در خود صفحه‌ها و APIها با پایگاه داده انجام می‌شود.
 */
const STAFF_PATHS = ['/admin/bookings'];
const STAFF_HOME = '/admin/bookings/new';

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const staffAllowed = STAFF_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!staffAllowed && (await roleOf(req)) === 'STAFF') {
    return NextResponse.redirect(new URL(STAFF_HOME, req.url));
  }

  const headers = new Headers(req.headers);
  headers.set('x-pathname', path);
  return NextResponse.next({ request: { headers } });
}

async function roleOf(req: NextRequest): Promise<string | null> {
  const value = req.cookies.get('pp_session')?.value;
  const secret = process.env.AUTH_SECRET;
  if (!value || !secret) return null;
  const jwt = value.slice(0, value.lastIndexOf('.'));
  try {
    const { payload } = await jwtVerify(jwt, new TextEncoder().encode(secret), { issuer: 'persian-padel' });
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
