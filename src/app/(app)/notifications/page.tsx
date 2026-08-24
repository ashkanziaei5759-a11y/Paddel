import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { markAllRead } from '@/lib/notifications';
import { NOTIFICATION_ICON } from '@/lib/constants';
import { formatRelative } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/Icon';

export const metadata: Metadata = { title: 'اعلان‌ها' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requirePage();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // با باز شدن صفحه همه‌ی اعلان‌ها خوانده‌شده علامت می‌خورند
  await markAllRead(user.id);

  return (
    <>
      <TopBar title="اعلان‌ها" subtitle="پیام‌های باشگاه" back="/home" />

      <div className="page-pad pt-2">
        {notifications.length === 0 ? (
          <EmptyState
            icon="notification"
            title="اعلانی ندارید"
            description="اعلان‌های مربوط به رزرو، کیف پول و تورنومنت‌ها اینجا نمایش داده می‌شوند."
          />
        ) : (
          <div className="stagger space-y-2">
            {notifications.map((n) => {
              const content = (
                <div
                  className={cn(
                    'card flex items-start gap-3 p-4 transition',
                    !n.readAt && 'ring-1 ring-accent/30',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon name={NOTIFICATION_ICON[n.type] as IconName} className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-extrabold text-brand-800">{n.title}</p>
                      {!n.readAt && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-6 text-brand-500">{n.body}</p>
                    <p className="mt-1.5 text-[10px] font-bold text-brand-300">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                </div>
              );

              return n.actionUrl ? (
                <Link key={n.id} href={n.actionUrl} className="block">
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
