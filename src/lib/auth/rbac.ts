import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser, type SessionUser } from './session';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** برای صفحات: در صورت نبود نشست به صفحه‌ی ورود هدایت می‌کند */
export async function requirePage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requirePage();
  if (user.role !== 'ADMIN') redirect('/home');
  return user;
}

/** برای مسیرهای API: خطای ۴۰۱/۴۰۳ پرتاب می‌کند */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('برای انجام این عملیات باید وارد حساب خود شوید.', 401);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new AuthError('دسترسی شما به این بخش مجاز نیست.', 403);
  return user;
}
