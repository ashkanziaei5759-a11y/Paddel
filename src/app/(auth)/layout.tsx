import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * پوسته‌ی صفحات احراز هویت.
 * چیدمان داخلی را خود صفحه تعیین می‌کند: صفحه‌ی ورود تمام‌عرض است و
 * ثبت‌نام و تأیید کد از `AuthShell` وسط‌چین استفاده می‌کنند.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect('/home');

  return <div className="min-h-dvh bg-white">{children}</div>;
}
