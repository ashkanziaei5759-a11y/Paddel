import 'server-only';
import type { MediaKind } from '@prisma/client';

/** بیشترین حجم پذیرفته‌شده پس از فشرده‌سازی در مرورگر */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

/**
 * فقط این سه قالب پذیرفته می‌شوند.
 *
 * SVG عمداً نیست: SVG می‌تواند اسکریپت داشته باشد و چون از دامنه‌ی خودمان سرو
 * می‌شود، آن اسکریپت به نشست کاربر دسترسی پیدا می‌کند.
 */
const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' &&
                 b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

/**
 * نوع تصویر از روی بایت‌های خودش تشخیص داده می‌شود، نه از Content-Type مرورگر.
 * سرصفحه‌ای که کلاینت می‌فرستد قابل جعل است؛ بایت‌های اول فایل نه.
 */
export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  return SIGNATURES.find((s) => s.test(bytes))?.mime ?? null;
}

/** ابعاد تصویر از سرصفحه‌ی خود فایل — برای اطمینان از اینکه واقعاً تصویر است */
export function readDimensions(bytes: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === 'image/png') {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }

    if (mime === 'image/webp') {
      const format = bytes.subarray(12, 16).toString('latin1');
      if (format === 'VP8X') {
        return {
          width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
          height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
        };
      }
      if (format === 'VP8L') {
        const bits = bytes.readUInt32LE(21);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
      }
      if (format === 'VP8 ') {
        return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
      }
      return null;
    }

    // JPEG: بخش‌ها را تا رسیدن به SOF دنبال می‌کنیم
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      // SOF0..SOF15، به‌جز نشانگرهای غیرتصویری
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}

export const MEDIA_KINDS: MediaKind[] = ['AVATAR', 'BANNER', 'ARTICLE_COVER', 'COURT', 'PRODUCT'];

/** نشانی عمومی یک تصویر ذخیره‌شده */
export function mediaUrl(id: string) {
  return `/api/media/${id}`;
}

/**
 * آیا تصویر کانال شفافیت دارد؟
 *
 * از سرصفحه‌ی خود فایل خوانده می‌شود. تنها راهِ قابل‌اعتماد است — کلاینت
 * می‌تواند هر چیزی ادعا کند، و رابط کاربری بر اساس همین تصمیم می‌گیرد که
 * تصویر را شناور نشان دهد یا داخل قاب.
 */
export function hasAlphaChannel(bytes: Buffer, mime: string): boolean {
  try {
    if (mime === 'image/png') {
      /* بایت ۲۵ در IHDR نوع رنگ است: ۴ = خاکستری+آلفا، ۶ = RGBA */
      const colorType = bytes[25];
      return colorType === 4 || colorType === 6;
    }

    if (mime === 'image/webp') {
      const format = bytes.subarray(12, 16).toString('latin1');
      /* در VP8X بیت آلفا در پرچم‌هاست؛ VP8L همیشه می‌تواند آلفا داشته باشد */
      if (format === 'VP8X') return (bytes[20] & 0b0001_0000) !== 0;
      if (format === 'VP8L') return true;
      return false;
    }

    /* JPEG اصلاً شفافیت ندارد */
    return false;
  } catch {
    return false;
  }
}
