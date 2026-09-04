import { getBranding } from '@/lib/branding';
import { requireAdminPage } from '@/lib/auth/rbac';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, branding] = await Promise.all([requireAdminPage(), getBranding()]);

  return (
    <div className="min-h-dvh bg-surface-muted lg:flex">
      <AdminNav fullName={user.fullName} username={user.username} logoUrl={branding.logoUrl} />
      <main className="flex-1 pb-24 lg:pb-8">{children}</main>
    </div>
  );
}
