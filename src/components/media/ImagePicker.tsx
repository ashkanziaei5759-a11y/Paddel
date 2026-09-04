'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { prepareImage, uploadImage, type PreparedImage } from '@/lib/image-client';
import { cn } from '@/lib/utils';

type Kind = 'AVATAR' | 'BANNER' | 'ARTICLE_COVER' | 'COURT' | 'PRODUCT' | 'BRANDING';

/**
 * انتخاب تصویر از گالری گوشی.
 *
 * جریان کار: انتخاب → کوچک‌سازی در مرورگر → پیش‌نمایش → (اختیاری) حذف
 * پس‌زمینه → آپلود. تا وقتی کاربر تأیید نکرده چیزی به سرور نمی‌رود، و اگر
 * حذف پس‌زمینه نتیجه‌ی خوبی نداد می‌تواند به تصویر اصلی برگردد.
 */
export function ImagePicker({
  value,
  onChange,
  kind,
  label = 'انتخاب تصویر',
  hint,
  aspect = 'square',
  allowCutout = false,
  className,
}: {
  value: string | null;
  /**
   * پس از آپلود صدا زده می‌شود. اگر Promise برگرداند، تا پایانش منتظر می‌مانیم
   * و پیام موفقیت را تا آن موقع نشان نمی‌دهیم — یعنی وقتی کاربر «ذخیره شد» را
   * می‌بیند، تصویر واقعاً جایی نشسته که باید.
   */
  onChange: (url: string | null) => void | Promise<void>;
  kind: Kind;
  label?: string;
  hint?: string;
  aspect?: 'square' | 'wide' | 'portrait' | 'tall';
  allowCutout?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [working, setWorking] = useState<null | 'PREPARE' | 'CUTOUT' | 'UPLOAD'>(null);
  const [draft, setDraft] = useState<PreparedImage | null>(null);
  const [original, setOriginal] = useState<PreparedImage | null>(null);

  const preview = draft?.previewUrl ?? value;
  const busy = working !== null;

  const frame =
    aspect === 'square' ? 'aspect-square w-32'
      : aspect === 'portrait' ? 'aspect-[3/4] w-32'
        : aspect === 'tall' ? 'aspect-[9/16] w-32'
          : 'aspect-[16/7] w-full';

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    /* ورودی پاک می‌شود تا انتخاب دوباره‌ی همان فایل هم رویداد بدهد */
    event.target.value = '';
    if (!file) return;

    setWorking('PREPARE');
    try {
      /* پوستر ورود تمام‌صفحه نشان داده می‌شود، پس لبه‌ی بلندتری لازم دارد؛
         عکس پروفایل کوچک است و بزرگ نگه داشتنش فقط حجم می‌گیرد. */
      const maxEdge = kind === 'AVATAR' ? 900 : kind === 'BRANDING' ? 1920 : 1600;
      const prepared = await prepareImage(file, { maxEdge });
      releaseDrafts();
      setDraft(prepared);
      setOriginal(prepared);
    } catch {
      toast.error('خواندن این تصویر ممکن نبود. تصویر دیگری انتخاب کنید.');
    } finally {
      setWorking(null);
    }
  }

  async function cutout() {
    if (!draft) return;
    setWorking('CUTOUT');
    try {
      const { removeBackground, cutoutSupported } = await import('@/lib/cutout');
      if (!cutoutSupported()) throw new Error('UNSUPPORTED');

      const cut = await removeBackground(draft.blob);
      /* شفافیت لازم است، پس PNG می‌ماند */
      const prepared = await prepareImage(cut, { keepAlpha: true, maxEdge: 900 });
      if (draft !== original) URL.revokeObjectURL(draft.previewUrl);
      setDraft(prepared);
      toast.success('پس‌زمینه حذف شد.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      toast.error(
        reason === 'SUBJECT_NOT_FOUND'
          ? 'در این تصویر شخصی پیدا نشد. عکسی انتخاب کنید که چهره و بدن در آن دیده شود.'
          : 'حذف پس‌زمینه انجام نشد. تصویر اصلی دست‌نخورده باقی ماند.',
      );
    } finally {
      setWorking(null);
    }
  }

  function restore() {
    if (!original || !draft) return;
    if (draft !== original) URL.revokeObjectURL(draft.previewUrl);
    setDraft(original);
  }

  async function save() {
    if (!draft) return;
    setWorking('UPLOAD');
    try {
      const url = await uploadImage(draft.blob, kind);
      await onChange(url);
      releaseDrafts();
      setDraft(null);
      setOriginal(null);
      toast.success('تصویر ذخیره شد.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'آپلود ناموفق بود.');
    } finally {
      setWorking(null);
    }
  }

  function releaseDrafts() {
    if (draft) URL.revokeObjectURL(draft.previewUrl);
    if (original && original !== draft) URL.revokeObjectURL(original.previewUrl);
  }

  async function clear() {
    releaseDrafts();
    setDraft(null);
    setOriginal(null);
    try {
      await onChange(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف تصویر ناموفق بود.');
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={pick}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />

      {/* قاب عریض تمام پهنا را می‌گیرد، پس دکمه‌ها باید زیرش بروند نه کنارش */}
      <div className={cn('flex items-start gap-3', aspect === 'wide' && 'flex-col')}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            'relative shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 bg-surface-muted transition',
            'flex items-center justify-center text-brand-300 hover:border-brand-300 disabled:opacity-60',
            frame,
            preview && 'border-solid border-brand-100',
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-7 w-7" strokeWidth={1.7} />
          )}

          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-scrim/60">
              <Spinner />
            </span>
          )}
        </button>

        <div className={cn("min-w-0 space-y-2", aspect === "wide" ? "w-full" : "flex-1")}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn-outline btn-sm w-full"
          >
            {preview ? 'تغییر تصویر' : label}
          </button>

          {hint && <p className="text-[10.5px] font-semibold leading-5 text-brand-300">{hint}</p>}

          {(preview || draft) && (
            <div className="flex flex-wrap gap-2">
              {allowCutout && draft && (
                <button
                  type="button"
                  onClick={cutout}
                  disabled={busy}
                  className="btn-outline btn-sm flex-1 gap-1.5"
                >
                  {working === 'CUTOUT' ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
                  حذف پس‌زمینه
                </button>
              )}

              {draft && original && draft !== original && (
                <button
                  type="button"
                  onClick={restore}
                  disabled={busy}
                  aria-label="بازگشت به تصویر اصلی"
                  className="btn-outline btn-sm px-3"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              )}

              {!draft && value && (
                <button
                  type="button"
                  onClick={clear}
                  disabled={busy}
                  aria-label="حذف تصویر"
                  className="btn-outline btn-sm px-3 text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {draft && (
        <div className="flex gap-2">
          <button type="button" onClick={clear} disabled={busy} className="btn-outline btn-sm flex-1">
            انصراف
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-accent btn-sm flex-1">
            {working === 'UPLOAD' ? <Spinner /> : 'ذخیره تصویر'}
          </button>
        </div>
      )}

      {allowCutout && draft && (
        <p className="text-[10px] font-semibold leading-5 text-brand-300">
          بار اول، حذف پس‌زمینه چند مگابایت دانلود دارد و کمی طول می‌کشد. دفعه‌های بعد سریع است.
        </p>
      )}
    </div>
  );
}
