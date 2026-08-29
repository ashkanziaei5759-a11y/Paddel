import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { formatJalaliDate, toFaDigits } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug: decodeURIComponent(slug) },
    select: { title: true, excerpt: true },
  });
  return { title: article?.title ?? 'خبر', description: article?.excerpt ?? undefined };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePage();
  const { slug } = await params;

  const [article, unread] = await Promise.all([
    prisma.article.findUnique({
      where: { slug: decodeURIComponent(slug) },
      include: { author: { include: { profile: { select: { firstName: true, lastName: true } } } } },
    }),
    unreadCount(user.id),
  ]);

  if (!article) notFound();
  if (article.status !== 'PUBLISHED' && user.role !== 'ADMIN') notFound();

  /* شمارنده‌ی بازدید نباید رندر صفحه را نگه دارد */
  void prisma.article
    .update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const author = article.author?.profile;

  return (
    <>
      <TopBar user={user} unread={unread} title="خبر" back="/news" />

      <article className="page-pad stagger space-y-4 pt-1">
        {article.status !== 'PUBLISHED' && (
          <p className="rounded-2xl bg-accent-50 px-4 py-3 text-[11px] font-bold text-accent-700">
            این مطلب هنوز منتشر نشده و فقط برای مدیران دیده می‌شود.
          </p>
        )}

        {article.coverUrl && (
          <div className="h-52 w-full overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <header>
          <h1 className="text-xl font-black leading-9 text-brand-800 text-balance">
            {article.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-brand-300">
            <span>{formatJalaliDate(article.publishedAt ?? article.createdAt)}</span>
            {author && <span>نوشته‌ی {author.firstName} {author.lastName}</span>}
            <span className="num">{toFaDigits(article.viewCount)} بازدید</span>
          </div>
        </header>

        {article.excerpt && (
          <p className="rounded-2xl bg-surface-muted px-4 py-3.5 text-[12.5px] font-bold leading-8 text-brand-600">
            {article.excerpt}
          </p>
        )}

        {/* متن ساده است؛ هر خط خالی یک پاراگراف تازه می‌سازد */}
        <div className="space-y-4">
          {article.body
            .split(/\n{2,}/)
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className="whitespace-pre-line text-[13px] leading-9 text-brand-600">
                {para}
              </p>
            ))}
        </div>
      </article>
    </>
  );
}
