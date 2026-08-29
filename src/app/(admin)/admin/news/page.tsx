import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { NewsManager, type AdminArticleDto } from './NewsManager';

export const metadata: Metadata = { title: 'اخبار باشگاه' };
export const dynamic = 'force-dynamic';

export default async function AdminNewsPage() {
  await requireAdminPage();

  const articles = await prisma.article.findMany({
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  const dto: AdminArticleDto[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
    coverUrl: a.coverUrl,
    status: a.status,
    isPinned: a.isPinned,
    viewCount: a.viewCount,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-black text-brand-800">اخبار باشگاه</h1>
        <p className="mt-1 text-[11.5px] font-semibold text-brand-400">
          گزارش مسابقات، مصاحبه و نکته‌های آموزشی. مطلب پیش‌نویس فقط برای مدیران دیده می‌شود.
        </p>
      </header>
      <NewsManager articles={dto} />
    </div>
  );
}
