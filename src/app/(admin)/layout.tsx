import { requireAdminPage } from '@/lib/auth/rbac';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();

  return (
    <div className="min-h-dvh bg-surface-muted lg:flex">
      <AdminNav fullName={user.fullName} username={user.username} />
      <main className="flex-1 pb-24 lg:pb-8">{children}</main>
    </div>
  );
}
