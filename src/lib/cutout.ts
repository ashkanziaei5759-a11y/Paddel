/**
 * حذف پس‌زمینه‌ی تصویر در مرورگر.
 *
 * از مدل «تفکیک سوژه از پس‌زمینه»ی MediaPipe استفاده می‌شود که مخصوص عکس
 * انسان است و روی گوشی سریع اجرا می‌شود. مدل و فایل‌های اجرایی از خود سایت
 * سرو می‌شوند، نه از CDN بیرونی — چون در ایران CDNهای خارجی ناپایدارند.
 *
 * هزینه‌ی دانلود (حدود ۳ مگابایت) فقط وقتی پرداخت می‌شود که کاربر روی
 * «حذف پس‌زمینه» بزند، و پس از آن در حافظه‌ی مرورگر می‌ماند.
 *
 * کیفیت لبه‌ها بیشتر از خودِ مدل، به پردازش پس از آن بستگی دارد. خروجی خام
 * مدل یک ماسکِ درشتِ ۲۵۶×۲۵۶ است؛ اگر همان مستقیم روی تصویر بنشیند، لبه‌ها
 * پله‌پله و دور مو حفره‌حفره می‌شود. مراحل زیر همان را قابل استفاده می‌کنند.
 */

import { canvasToBlob } from './image-client';

interface MpMask {
  getAsFloat32Array: () => Float32Array;
  width: number;
  height: number;
  close: () => void;
}

type Segmenter = {
  segment: (image: HTMLCanvasElement) => {
    confidenceMasks?: MpMask[];
    categoryMask?: { getAsUint8Array: () => Uint8Array; close: () => void };
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
        /* ماسکِ احتمال (۰ تا ۱) به‌جای ماسکِ دودویی — لبه‌ی نرم از همین می‌آید */
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })) as unknown as Segmenter;
    })().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

export function cutoutSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof WebAssembly === 'object' &&
    typeof document.createElement('canvas').getContext === 'function'
  );
}

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
  const masks = result.confidenceMasks ?? [];
  if (masks.length === 0) throw new Error('NO_MASK');

  const subject = pickSubjectMask(masks);
  const width = subject.width;
  const height = subject.height;
  const confidence = Float32Array.from(subject.data);
  masks.forEach((m) => m.close());

  /* ۱. تکه‌های پرت را دور می‌ریزیم: فقط بزرگ‌ترین ناحیه‌ی پیوسته می‌ماند.
        بدون این، سایه‌ها و اجسام کنار سوژه هم به‌عنوان «شخص» باقی می‌مانند. */
  keepLargestBlob(confidence, width, height, 0.5);

  /* ۲. لبه را کمی به داخل می‌کشیم تا هاله‌ی رنگِ پس‌زمینه دور سوژه نماند */
  erode(confidence, width, height);

  /* ۳. منحنی نرم: به‌جای برش تیز در ۰٫۵، یک شیب کوتاه حول آن.
        این چیزی است که لبه‌ی مو را طبیعی می‌کند. */
  const LO = 0.35;
  const HI = 0.62;
  let kept = 0;
  for (let i = 0; i < confidence.length; i += 1) {
    const t = Math.min(1, Math.max(0, (confidence[i] - LO) / (HI - LO)));
    const alpha = t * t * (3 - 2 * t); // smoothstep
    confidence[i] = alpha;
    if (alpha > 0.5) kept += 1;
  }

  const keptRatio = kept / confidence.length;
  if (keptRatio < 0.03 || keptRatio > 0.985) throw new Error('SUBJECT_NOT_FOUND');

  /* ۴. ماسکِ کوچک را با درون‌یابی نرمِ خودِ مرورگر تا اندازه‌ی تصویر بزرگ
        می‌کنیم — پله‌های ۲۵۶ پیکسلی این‌طور از بین می‌رود. */
  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = width;
  alphaCanvas.height = height;
  const alphaCtx = alphaCanvas.getContext('2d');
  if (!alphaCtx) throw new Error('CANVAS_UNAVAILABLE');
  const small = alphaCtx.createImageData(width, height);
  for (let i = 0; i < confidence.length; i += 1) {
    const v = Math.round(confidence[i] * 255);
    small.data[i * 4] = v;
    small.data[i * 4 + 1] = v;
    small.data[i * 4 + 2] = v;
    small.data[i * 4 + 3] = 255;
  }
  alphaCtx.putImageData(small, 0, 0);

  const upscaled = document.createElement('canvas');
  upscaled.width = canvas.width;
  upscaled.height = canvas.height;
  const upCtx = upscaled.getContext('2d', { willReadFrequently: true });
  if (!upCtx) throw new Error('CANVAS_UNAVAILABLE');
  upCtx.imageSmoothingEnabled = true;
  upCtx.imageSmoothingQuality = 'high';
  upCtx.drawImage(alphaCanvas, 0, 0, canvas.width, canvas.height);

  /* ۵. آلفا را روی تصویر می‌نشانیم */
  const alphaData = upCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 4) {
    pixels[i + 3] = alphaData[p];
  }
  ctx.putImageData(image, 0, 0);

  return canvasToBlob(trimTransparentEdges(canvas), true, 1);
}

/**
 * کدام ماسک، سوژه است؟
 *
 * مدل‌ها ترتیب کلاس‌ها را یکسان نمی‌گذارند و اگر اشتباه انتخاب شود، دقیقاً
 * برعکس عمل می‌کند: شخص حذف می‌شود و پس‌زمینه می‌ماند. به‌جای فرض کردن، از
 * خود تصویر می‌پرسیم: در عکس پرتره حاشیه‌ی قاب تقریباً همیشه پس‌زمینه است، پس
 * ماسکی که در حاشیه کمترین مقدار را دارد، سوژه است.
 */
function pickSubjectMask(masks: MpMask[]): { data: Float32Array; width: number; height: number } {
  const scored = masks.map((mask) => {
    const data = mask.getAsFloat32Array();
    return { data, width: mask.width, height: mask.height, border: borderMean(data, mask.width, mask.height) };
  });

  if (scored.length === 1) {
    const only = scored[0];
    /* با یک ماسک، اگر حاشیه پررنگ باشد یعنی این ماسکِ پس‌زمینه است — وارونه‌اش می‌کنیم */
    if (only.border > 0.5) {
      const flipped = new Float32Array(only.data.length);
      for (let i = 0; i < only.data.length; i += 1) flipped[i] = 1 - only.data[i];
      return { data: flipped, width: only.width, height: only.height };
    }
    return only;
  }

  return scored.reduce((best, m) => (m.border < best.border ? m : best));
}

/** میانگین مقدار ماسک روی نوار باریک حاشیه */
function borderMean(data: Float32Array, width: number, height: number) {
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.05));
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let b = 0; b < band; b += 1) {
      sum += data[y * width + b] + data[y * width + (width - 1 - b)];
      count += 2;
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let b = 0; b < band; b += 1) {
      sum += data[b * width + x];
      count += 1;
    }
  }
  return sum / count;
}

/** فقط بزرگ‌ترین ناحیه‌ی پیوسته را نگه می‌دارد؛ بقیه صفر می‌شوند */
function keepLargestBlob(mask: Float32Array, width: number, height: number, threshold: number) {
  const labels = new Int32Array(mask.length).fill(-1);
  const queue = new Int32Array(mask.length);
  let bestLabel = -1;
  let bestSize = 0;
  let label = 0;

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] < threshold || labels[start] !== -1) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let size = 0;

    while (head < tail) {
      const index = queue[head++];
      size += 1;
      const x = index % width;
      const y = (index / width) | 0;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (labels[n] !== -1 || mask[n] < threshold) continue;
        labels[n] = label;
        queue[tail++] = n;
      }
    }

    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
    label += 1;
  }

  if (bestLabel === -1) return;
  for (let i = 0; i < mask.length; i += 1) {
    if (labels[i] !== bestLabel) mask[i] = 0;
  }
}

/** یک پیکسل از لبه‌ی سوژه کم می‌کند تا رنگ پس‌زمینه به آن نچسبد */
function erode(mask: Float32Array, width: number, height: number) {
  const copy = Float32Array.from(mask);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (copy[i] === 0) continue;
      let min = copy[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        min = Math.min(min, copy[ny * width + nx]);
      }
      mask[i] = min;
    }
  }
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
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (right <= left || bottom <= top) return canvas;

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
