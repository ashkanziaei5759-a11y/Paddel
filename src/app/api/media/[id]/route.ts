import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * سرو کردن تصویر ذخیره‌شده.
 *
 * بدون احراز هویت است تا تگ <img> بتواند مستقیم بارگذاری کند و تصویرها در
 * حافظه‌ی مرورگر و CDN بمانند. شناسه تصادفی است و حدس‌زدنی نیست، و اینجا هیچ
 * چیز حساسی ذخیره نمی‌شود — فقط عکس پروفایل و بنر و کاور خبر.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { bytes: true, mimeType: true, byteSize: true },
  });

  if (!asset) return new Response('Not Found', { status: 404 });

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.byteSize),
      /* محتوای هر شناسه هرگز عوض نمی‌شود، پس می‌تواند برای همیشه کش شود */
      'Cache-Control': 'public, max-age=31536000, immutable',
      /* مرورگر نباید نوع فایل را خودش حدس بزند */
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
