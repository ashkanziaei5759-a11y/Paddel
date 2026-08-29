import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { mediaUrl } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const url = mediaUrl(id);

    /* ارجاع‌ها پاک می‌شوند تا جایی به تصویرِ نبوده اشاره نکند */
    await prisma.$transaction([
      prisma.profile.updateMany({ where: { avatarUrl: url }, data: { avatarUrl: null } }),
      prisma.article.updateMany({ where: { coverUrl: url }, data: { coverUrl: null } }),
      prisma.court.updateMany({ where: { imageUrl: url }, data: { imageUrl: null } }),
      prisma.storeProduct.updateMany({ where: { imageUrl: url }, data: { imageUrl: null } }),
      prisma.mediaAsset.delete({ where: { id } }),
    ]);

    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
