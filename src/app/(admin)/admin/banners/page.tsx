import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { BannerManager, type BannerRow } from './BannerManager';
import { toFaDigits } from '@/lib/datetime';

export const metadata: Metadata = { title: 'مدیریت بنرها' };
export const dynamic = 'force-dynamic';

export default async function AdminBannersPage() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  const rows: BannerRow[] = banners.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    sortOrder: b.sortOrder,
    isActive: b.isActive,
    startsAt: b.startsAt?.toISOString() ?? '',
    endsAt: b.endsAt?.toISOString() ?? '',
  }));

  return (
    <>
      <AdminHeader
        title="بنرهای صفحه‌ی اصلی"
        subtitle={`${toFaDigits(banners.length)} بنر — به‌ترتیب چیدمان نمایش داده می‌شوند`}
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <BannerManager initial={rows} />
      </div>
    </>
  );
}
