import { NextRequest } from 'next/server';
import type { MediaKind } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { AppError, clientIp, handleApiError, ok } from '@/lib/api';
import {
  MAX_UPLOAD_BYTES,
  MEDIA_KINDS,
  hasAlphaChannel,
  mediaUrl,
  readDimensions,
  sniffImageMime,
} from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** فقط مدیران می‌توانند تصاویر عمومی باشگاه را عوض کنند */
const ADMIN_ONLY: MediaKind[] = ['BANNER', 'ARTICLE_COVER', 'COURT', 'PRODUCT', 'BRANDING'];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    /* بدون سقف، یک حساب می‌تواند پایگاه داده را پر کند */
    const limit = await rateLimit(`upload:${user.id}`, 30, 3600);
    if (!limit.allowed) {
      throw new AppError(
        'تعداد آپلود شما در این ساعت زیاد بوده است. کمی بعد دوباره تلاش کنید.',
        429,
        'RATE_LIMITED',
      );
    }

    const form = await req.formData();
    const file = form.get('file');
    const kindRaw = String(form.get('kind') ?? 'AVATAR');

    if (!(file instanceof File)) throw new AppError('فایلی دریافت نشد.');
    if (!MEDIA_KINDS.includes(kindRaw as MediaKind)) throw new AppError('نوع تصویر معتبر نیست.');
    const kind = kindRaw as MediaKind;

    if (ADMIN_ONLY.includes(kind) && user.role !== 'ADMIN') {
      throw new AppError('اجازه‌ی این کار را ندارید.', 403);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppError('حجم تصویر بیش از حد مجاز است. تصویر کوچک‌تری انتخاب کنید.', 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    /* نوع فایل از بایت‌های خودش خوانده می‌شود، نه از چیزی که مرورگر ادعا کرده */
    const mimeType = sniffImageMime(bytes);
    if (!mimeType) {
      throw new AppError('فقط تصویر JPEG، PNG یا WebP پذیرفته می‌شود.', 415);
    }

    const size = readDimensions(bytes, mimeType);
    if (!size || size.width < 16 || size.height < 16 || size.width > 6000 || size.height > 6000) {
      throw new AppError('ابعاد تصویر معتبر نیست.', 415);
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        kind,
        mimeType,
        bytes: new Uint8Array(bytes),
        byteSize: bytes.length,
        width: size.width,
        height: size.height,
        hasAlpha: hasAlphaChannel(bytes, mimeType),
        uploadedById: user.id,
      },
      select: { id: true, width: true, height: true, byteSize: true, hasAlpha: true },
    });

    return ok({ ...asset, url: mediaUrl(asset.id) }, { status: 201 });
  } catch (error) {
    console.error('[upload]', error instanceof Error ? error.message : error, clientIp(req));
    return handleApiError(error);
  }
}
