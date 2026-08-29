import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { MediaLibrary, type MediaRow } from './MediaLibrary';

export const metadata: Metadata = { title: 'تصاویر' };
export const dynamic = 'force-dynamic';

/**
 * هر تصویری که کسی در اپ آپلود می‌کند — عکس پروفایل، بنر، کاور خبر، عکس زمین
 * و کالا — در جدول media_assets پایگاه داده می‌نشیند. این صفحه همان جدول است.
 */
export default async function AdminMediaPage() {
  await requireAdminPage();

  const [assets, byKind, profiles, banners, articles, courts, products] = await Promise.all([
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, kind: true, mimeType: true, byteSize: true,
        width: true, height: true, hasAlpha: true, createdAt: true,
        uploadedBy: { select: { username: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.mediaAsset.groupBy({ by: ['kind'], _count: { _all: true }, _sum: { byteSize: true } }),
    prisma.profile.findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } }),
    prisma.banner.findMany({ select: { imageUrl: true } }),
    prisma.article.findMany({ where: { coverUrl: { not: null } }, select: { coverUrl: true } }),
    prisma.court.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.storeProduct.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
  ]);

  /* کدام تصویرها واقعاً جایی استفاده می‌شوند؟ بقیه فقط جا اشغال می‌کنند. */
  const used = new Set(
    [
      ...profiles.map((p) => p.avatarUrl),
      ...banners.map((b) => b.imageUrl),
      ...articles.map((a) => a.coverUrl),
      ...courts.map((c) => c.imageUrl),
      ...products.map((p) => p.imageUrl),
    ]
      .map((url) => url?.match(/^\/api\/media\/([a-z0-9]+)$/i)?.[1])
      .filter(Boolean) as string[],
  );

  const rows: MediaRow[] = assets.map((a) => ({
    id: a.id,
    kind: a.kind,
    mimeType: a.mimeType,
    byteSize: a.byteSize,
    width: a.width,
    height: a.height,
    hasAlpha: a.hasAlpha,
    createdAt: a.createdAt.toISOString(),
    uploader: a.uploadedBy?.profile
      ? `${a.uploadedBy.profile.firstName} ${a.uploadedBy.profile.lastName}`
      : (a.uploadedBy?.username ?? '—'),
    inUse: used.has(a.id),
  }));

  const totals = byKind.map((k) => ({
    kind: k.kind,
    count: k._count._all,
    bytes: k._sum.byteSize ?? 0,
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-black text-brand-800">تصاویر</h1>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          هر تصویری که در اپ آپلود می‌شود، داخل پایگاه داده و در جدول جداگانه‌ی
          <code className="mx-1">media_assets</code>
          ذخیره می‌شود — نه روی دیسک سرور. این فهرست همان جدول است.
        </p>
      </header>
      <MediaLibrary rows={rows} totals={totals} />
    </div>
  );
}
