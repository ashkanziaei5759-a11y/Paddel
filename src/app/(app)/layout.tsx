import { BottomNav } from '@/components/nav/BottomNav';
import { requirePage } from '@/lib/auth/rbac';
import { unreadCount } from '@/lib/notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const unread = await unreadCount(user.id);

  return (
    <div className="min-h-dvh bg-surface-muted">
      <main className="app-shell page-bottom-gap">{children}</main>
      <BottomNav notificationCount={unread} />
    </div>
  );
}
