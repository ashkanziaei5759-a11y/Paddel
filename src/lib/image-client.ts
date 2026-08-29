/**
 * پردازش تصویر در مرورگر — پیش از آپلود.
 *
 * عکس گوشی‌های امروزی چند مگابایت است. اگر خام فرستاده شود، هم آپلود روی
 * اینترنت موبایل طول می‌کشد و هم پایگاه داده بی‌دلیل بزرگ می‌شود. اینجا تصویر
 * کوچک و فشرده می‌شود، بنابراین چیزی که به سرور می‌رسد چند صد کیلوبایت است.
 */

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

const MAX_EDGE = 1600;

/** خواندن فایل به یک تصویر قابل رسم روی canvas */
async function toBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    /* گوشی‌ها عکس را چرخانده ذخیره می‌کنند و جهت واقعی در EXIF است */
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    /* نشانی پس از decode لازم نیست؛ داده در خود تصویر است */
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function fittedSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** کوچک و فشرده کردن تصویر. اگر شفافیت لازم باشد PNG، وگرنه JPEG. */
export async function prepareImage(
  file: Blob,
  options: { maxEdge?: number; keepAlpha?: boolean; quality?: number } = {},
): Promise<PreparedImage> {
  const bitmap = await toBitmap(file);
  const sourceWidth = 'width' in bitmap ? bitmap.width : 0;
  const sourceHeight = 'height' in bitmap ? bitmap.height : 0;
  const { width, height } = fittedSize(sourceWidth, sourceHeight, options.maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  if ('close' in bitmap) bitmap.close();

  const blob = await canvasToBlob(canvas, options.keepAlpha ?? false, options.quality ?? 0.86);
  return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
}

export function canvasToBlob(canvas: HTMLCanvasElement, keepAlpha: boolean, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('ENCODE_FAILED'))),
      keepAlpha ? 'image/png' : 'image/jpeg',
      keepAlpha ? undefined : quality,
    );
  });
}

/** آپلود به سرور و گرفتن نشانی نهایی */
export async function uploadImage(blob: Blob, kind: string): Promise<string> {
  const form = new FormData();
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  form.append('file', blob, `upload.${extension}`);
  form.append('kind', kind);

  const res = await fetch('/api/uploads', { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'آپلود تصویر ناموفق بود.');
  }
  return json.data.url as string;
}
