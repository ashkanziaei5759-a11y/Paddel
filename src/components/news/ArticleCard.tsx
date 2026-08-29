import Link from 'next/link';
import { Pin } from 'lucide-react';
import { formatJalaliDate } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface ArticleCardDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  publishedAt: string;
  isPinned: boolean;
}

/** خلاصه — اگر نویسنده ننوشته باشد، از ابتدای متن ساخته می‌شود */
export function summarize(article: { excerpt: string | null; body: string }, max = 120) {
  if (article.excerpt?.trim()) return article.excerpt.trim();
  const plain = article.body.replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

export function ArticleCard({
  article,
  featured,
}: {
  article: ArticleCardDto;
  featured?: boolean;
}) {
  const date = formatJalaliDate(new Date(article.publishedAt));

  return (
    <Link
      href={`/news/${encodeURIComponent(article.slug)}`}
      className={cn(
        'card-interactive block overflow-hidden p-0',
        featured ? 'rounded-3xl' : 'rounded-3xl',
      )}
    >
      {article.coverUrl && (
        <div className={cn('relative w-full overflow-hidden', featured ? 'h-44' : 'h-32')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.coverUrl} alt="" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim/75 to-transparent" />
          {article.isPinned && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-black text-on-accent">
              <Pin className="h-3 w-3" />
              سنجاق‌شده
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        <h3
          className={cn(
            'font-extrabold leading-7 text-brand-800 text-balance',
            featured ? 'text-[15px]' : 'text-[13px]',
          )}
        >
          {article.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11.5px] font-semibold leading-6 text-brand-400">
          {summarize(article)}
        </p>
        <p className="mt-2.5 text-[10.5px] font-bold text-brand-300">{date}</p>
      </div>
    </Link>
  );
}
