/**
 * حذف پس‌زمینه‌ی تصویر در مرورگر.
 *
 * از مدل «تفکیک سوژه از پس‌زمینه»ی MediaPipe استفاده می‌شود که مخصوص عکس
 * انسان است و روی گوشی سریع اجرا می‌شود. مدل و فایل‌های اجرایی از خود سایت
 * سرو می‌شوند، نه از CDN بیرونی — چون در ایران CDNهای خارجی ناپایدارند.
 *
 * هزینه‌ی دانلود (حدود ۳ مگابایت) فقط وقتی پرداخت می‌شود که کاربر واقعاً روی
 * «حذف پس‌زمینه» بزند، و پس از آن در حافظه‌ی مرورگر می‌ماند.
 */

import { canvasToBlob } from './image-client';

type Segmenter = {
  segment: (image: HTMLCanvasElement) => {
    categoryMask?: { getAsUint8Array: () => Uint8Array; close: () => void };
    confidenceMasks?: { getAsFloat32Array: () => Float32Array; close: () => void }[];
    close?: () => void;
  };
};

let segmenterPromise: Promise<Segmenter> | null = null;

async function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks('/vision/wasm');
      return (await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/vision/models/selfie_segmenter.tflite' },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })) as unknown as Segmenter;
    })().catch((error) => {
      /* تلاش بعدی نباید به همان خطای کش‌شده بخورد */
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

/** آیا این مرورگر توانِ اجرای مدل را دارد؟ */
export function cutoutSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof WebAssembly === 'object' &&
    typeof document.createElement('canvas').getContext === 'function'
  );
}

/**
 * پس‌زمینه را حذف می‌کند و PNG شفاف برمی‌گرداند.
 * اگر مدل بارگذاری نشود یا سوژه‌ای پیدا نکند، خطا می‌دهد تا فراخوان بتواند
 * تصویر اصلی را نگه دارد.
 */
export async function removeBackground(source: Blob): Promise<Blob> {
  const segmenter = await getSegmenter();

  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const result = segmenter.segment(canvas);
  const mask = result.categoryMask?.getAsUint8Array();

  if (!mask || mask.length !== canvas.width * canvas.height) {
    result.categoryMask?.close();
    throw new Error('NO_MASK');
  }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;

  /* کدام دسته پس‌زمینه است؟ به‌جای فرض کردن، از خود تصویر می‌پرسیم.
     نسخه‌های مختلف مدل شماره‌ی دسته‌ها را جابه‌جا می‌کنند و اگر اشتباه بگیریم،
     دقیقاً برعکس عمل می‌کند: شخص حذف می‌شود و پس‌زمینه می‌ماند.
     در عکس پرتره، حاشیه‌ی تصویر تقریباً همیشه پس‌زمینه است. */
  const backgroundClass = dominantBorderClass(mask, canvas.width, canvas.height);

  let kept = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] === backgroundClass) {
      pixels[i * 4 + 3] = 0;
    } else {
      kept += 1;
    }
  }
  result.categoryMask?.close();

  /* اگر تقریباً چیزی نماند یا تقریباً هیچ‌چیز حذف نشد، یعنی مدل سوژه‌ای
     تشخیص نداده و نتیجه به درد نمی‌خورد. تصویر اصلی بهتر است. */
  const keptRatio = kept / mask.length;
  if (keptRatio < 0.03 || keptRatio > 0.985) throw new Error('SUBJECT_NOT_FOUND');

  ctx.putImageData(image, 0, 0);
  const trimmed = trimTransparentEdges(canvas);
  return canvasToBlob(trimmed, true, 1);
}

/**
 * پرتکرارترین دسته در حاشیه‌ی تصویر — یعنی پس‌زمینه.
 * فقط نوار باریکی از لبه‌ها بررسی می‌شود، نه کل تصویر.
 */
function dominantBorderClass(mask: Uint8Array, width: number, height: number): number {
  const counts = new Map<number, number>();
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.04));

  const tally = (x: number, y: number) => {
    const value = mask[y * width + x];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  };

  for (let y = 0; y < height; y += 1) {
    for (let b = 0; b < band; b += 1) {
      tally(b, y);
      tally(width - 1 - b, y);
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let b = 0; b < band; b += 1) {
      tally(x, b);
    }
  }

  let best = 0;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** برش حاشیه‌های کاملاً شفاف تا سوژه قاب را پر کند */
function trimTransparentEdges(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let top = height;
  let bottom = 0;
  let left = width;
  let right = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (right <= left || bottom <= top) return canvas;

  /* کمی فضای تنفس دور سوژه */
  const pad = Math.round(Math.max(width, height) * 0.02);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d')?.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
