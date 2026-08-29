import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok, AppError } from '@/lib/api';
import { articleSchema, slugify } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const articles = await prisma.article.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { username: true } } },
      take: 100,
    });
    return ok({ articles });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = articleSchema.parse(await req.json());

    const slug = slugify(input.slug || input.title);
    if (!slug) throw new AppError('از روی عنوان نشانی معتبری ساخته نشد. نشانی را دستی وارد کنید.');

    const clash = await prisma.article.findUnique({ where: { slug } });
    if (clash) throw new AppError('مطلبی با همین نشانی وجود دارد.', 409);

    const article = await prisma.article.create({
      data: {
        slug,
        title: input.title,
        excerpt: input.excerpt || null,
        body: input.body,
        coverUrl: input.coverUrl || null,
        status: input.status,
        isPinned: input.isPinned,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        authorId: admin.id,
      },
    });

    return ok({ id: article.id, slug: article.slug }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
