import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { NotificationComposer } from './NotificationComposer';

export const metadata: Metadata = { title: 'ارسال اعلان' };
export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  await requireAdminPage();

  const [players, recent] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'PLAYER', status: 'ACTIVE' },
      select: { id: true, username: true, profile: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.notification.findMany({
      where: { type: 'ADMIN_MESSAGE' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        readAt: true,
        user: { select: { username: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-black text-brand-800">ارسال اعلان</h1>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          پیام مستقیم به یک بازیکن، یا اطلاعیه‌ی همگانی برای همه‌ی بازیکنان فعال.
        </p>
      </header>

      <NotificationComposer
        players={players.map((p) => ({
          id: p.id,
          username: p.username,
          name: p.profile ? `${p.profile.firstName} ${p.profile.lastName}` : p.username,
        }))}
        recent={recent.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          read: n.readAt !== null,
          to: n.user.profile
            ? `${n.user.profile.firstName} ${n.user.profile.lastName}`
            : n.user.username,
        }))}
      />
    </div>
  );
}
