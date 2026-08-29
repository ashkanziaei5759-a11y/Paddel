import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { ArticleCard } from '@/components/news/ArticleCard';

export const metadata: Metadata = { title: 'اخبار باشگاه' };
export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const user = await requirePage();

  const [articles, unread] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 40,
    }),
    unreadCount(user.id),
  ]);

  const [lead, ...rest] = articles;

  return (
    <>
      <TopBar user={user} unread={unread} title="اخبار باشگاه" subtitle="تازه‌ها، گزارش‌ها و آموزش" />

      <div className="page-pad stagger space-y-4 pt-1">
        {articles.length === 0 ? (
          <EmptyState
            icon="notification"
            title="هنوز مطلبی منتشر نشده"
            description="به‌زودی گزارش مسابقات، مصاحبه‌ها و نکته‌های آموزشی اینجا منتشر می‌شود."
          />
        ) : (
          <>
            <ArticleCard article={serializeArticle(lead)} featured />
            {rest.length > 0 && (
              <div className="space-y-3">
                {rest.map((a) => (
                  <ArticleCard key={a.id} article={serializeArticle(a)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function serializeArticle(a: {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  publishedAt: Date | null;
  isPinned: boolean;
}) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
    coverUrl: a.coverUrl,
    publishedAt: (a.publishedAt ?? new Date()).toISOString(),
    isPinned: a.isPinned,
  };
}
