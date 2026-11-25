import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBranding } from '@/lib/branding';
import { requireStaffPage } from '@/lib/auth/rbac';
import { AdminNav } from '@/components/admin/AdminNav';

/** صفحه‌هایی که ادمین پذیرش (STAFF) می‌بیند؛ بقیه‌ی پنل فقط برای مدیر کل است.
    بررسی اصلی در src/middleware.ts است؛ این‌جا لایه‌ی دوم با نقشِ پایگاه داده. */
const STAFF_PATHS = ['/admin/bookings'];
const STAFF_HOME = '/admin/bookings/new';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, branding, h] = await Promise.all([requireStaffPage(), getBranding(), headers()]);

  if (user.role === 'STAFF') {
    const path = h.get('x-pathname') ?? '';
    const allowed = STAFF_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
    if (!allowed) redirect(STAFF_HOME);
  }

  return (
    <div className="min-h-dvh bg-surface-muted lg:flex">
      <AdminNav
        fullName={user.fullName}
        username={user.username}
        logoUrl={branding.logoUrl}
        role={user.role === 'ADMIN' ? 'ADMIN' : 'STAFF'}
      />
      <main className="flex-1 pb-24 lg:pb-8">{children}</main>
    </div>
  );
}
