import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { rialToToman } from '@/lib/utils';
import { NotificationsAdmin } from './NotificationsAdmin';

export const metadata: Metadata = { title: 'اعلان‌ها' };
export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  await requireAdminPage();
  const now = new Date();

  const [players, recent, banners, articles, rules, pushUsers] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'PLAYER', status: 'ACTIVE' },
      select: { id: true, username: true, profile: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    /* پیام همگانی همه‌ی ردیف‌ها را با یک sentAt می‌سازد؛ گروه‌بندی = یک پیام */
    prisma.notification.groupBy({
      by: ['title', 'body', 'sentAt', 'imageUrl'],
      where: { type: { in: ['ADMIN_MESSAGE', 'CLUB_NEWS'] }, data: { equals: Prisma.DbNull } },
      _count: { _all: true, readAt: true },
      orderBy: { sentAt: 'desc' },
      take: 15,
    }),
    prisma.banner.findMany({
      where: { isActive: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, subtitle: true, imageUrl: true, linkUrl: true },
      take: 30,
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, excerpt: true, coverUrl: true, slug: true },
      take: 30,
    }),
    prisma.notificationRule.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] }),
    prisma.pushSubscription.findMany({
      where: { user: { role: 'PLAYER', status: 'ACTIVE' } },
      distinct: ['userId'],
      select: { userId: true },
    }),
  ]);

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-lg font-black text-brand-800">اعلان‌ها</h1>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          پیام به یک بازیکن یا همه، خبر و بنر به‌صورت اعلان، و اعلان‌های خودکار با شرط‌های دلخواه.
        </p>
      </header>

      <NotificationsAdmin
        pushStats={{ players: players.length, withPush: pushUsers.length }}
        players={players.map((p) => ({
          id: p.id,
          username: p.username,
          name: p.profile ? `${p.profile.firstName} ${p.profile.lastName}` : p.username,
        }))}
        recent={recent.map((n, i) => ({
          id: `${n.sentAt?.toISOString() ?? i}-${i}`,
          title: n.title,
          body: n.body,
          imageUrl: n.imageUrl,
          sentAt: (n.sentAt ?? now).toISOString(),
          recipients: n._count._all,
          read: n._count.readAt,
        }))}
        attachments={[
          ...banners.map((b) => ({
            id: `banner:${b.id}`,
            kind: 'بنر' as const,
            title: b.title,
            body: b.subtitle ?? '',
            imageUrl: b.imageUrl,
            actionUrl: b.linkUrl ?? '',
          })),
          ...articles.map((a) => ({
            id: `news:${a.id}`,
            kind: 'خبر' as const,
            title: a.title,
            body: a.excerpt ?? '',
            imageUrl: a.coverUrl ?? '',
            actionUrl: `/news/${a.slug}`,
          })),
        ]}
        rules={rules.map((r) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger,
          offset: r.offset,
          thresholdToman: r.thresholdAmount !== null ? rialToToman(r.thresholdAmount) : null,
          runAt: r.runAt?.toISOString() ?? null,
          title: r.title,
          body: r.body,
          actionUrl: r.actionUrl ?? '',
          imageUrl: r.imageUrl ?? '',
          isActive: r.isActive,
          sentCount: r.sentCount,
          lastRunAt: r.lastRunAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
