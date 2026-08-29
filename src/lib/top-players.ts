import 'server-only';
import { prisma } from './db';
import type { TopPlayer } from '@/components/ranking/TopPlayersRail';

/**
 * تصویرهای پس‌زمینه‌حذف‌شده روی کارت شناور می‌شوند و از قاب بیرون می‌زنند؛
 * عکس معمولی باید داخل قاب بماند، وگرنه یک مستطیل روی کارت می‌افتد و اسم
 * بازیکن را می‌پوشاند.
 *
 * چون avatarUrl فقط یک رشته است، با یک کوئری کوتاه می‌پرسیم کدام‌یک شفافیت
 * دارند — به‌جای اینکه در هر صفحه join بزنیم.
 */
export async function withAlphaFlags<T extends { avatarUrl: string | null }>(
  rows: T[],
): Promise<(T & { avatarHasAlpha: boolean })[]> {
  const ids = rows
    .map((r) => r.avatarUrl?.match(/^\/api\/media\/([a-z0-9]+)$/i)?.[1])
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, avatarHasAlpha: false }));
  }

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true, hasAlpha: true },
  });
  const alpha = new Map(assets.map((a) => [a.id, a.hasAlpha]));

  return rows.map((r) => {
    const id = r.avatarUrl?.match(/^\/api\/media\/([a-z0-9]+)$/i)?.[1];
    return { ...r, avatarHasAlpha: id ? (alpha.get(id) ?? false) : false };
  });
}

export type { TopPlayer };
