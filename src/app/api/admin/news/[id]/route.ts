import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok, AppError } from '@/lib/api';
import { articleSchema, slugify } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = articleSchema.parse(await req.json());

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new AppError('مطلب یافت نشد.', 404);

    const slug = slugify(input.slug || input.title);
    if (!slug) throw new AppError('نشانی معتبر نیست.');
    if (slug !== existing.slug) {
      const clash = await prisma.article.findUnique({ where: { slug } });
      if (clash) throw new AppError('مطلبی با همین نشانی وجود دارد.', 409);
    }

    await prisma.article.update({
      where: { id },
      data: {
        slug,
        title: input.title,
        excerpt: input.excerpt || null,
        body: input.body,
        coverUrl: input.coverUrl || null,
        status: input.status,
        isPinned: input.isPinned,
        /* زمان انتشار فقط بار اول ثبت می‌شود تا ویرایش، تاریخ مطلب را جابه‌جا نکند */
        publishedAt:
          input.status === 'PUBLISHED' ? (existing.publishedAt ?? new Date()) : null,
      },
    });

    return ok({ id, slug });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await prisma.article.delete({ where: { id } });
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
