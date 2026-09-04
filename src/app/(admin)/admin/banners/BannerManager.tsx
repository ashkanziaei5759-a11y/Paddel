'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImageOff, Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { BannerCarousel } from '@/components/home/BannerCarousel';
import { ImagePicker } from '@/components/media/ImagePicker';
import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

function toLocalInput(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function BannerManager({ initial }: { initial: BannerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [active, setActive] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openNew() {
    setEditing(null);
    setActive(true);
    setImage(null);
    setOpen(true);
  }

  function openEdit(b: BannerRow) {
    setEditing(b);
    setActive(b.isActive);
    setImage(b.imageUrl ?? null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    const payload = {
      title: String(form.get('title') || ''),
      subtitle: String(form.get('subtitle') || '') || null,
      imageUrl: String(form.get('imageUrl') || ''),
      linkUrl: String(form.get('linkUrl') || '') || null,
      sortOrder: Number(form.get('sortOrder') || 0),
      isActive: active,
      startsAt: form.get('startsAt') ? new Date(String(form.get('startsAt'))).toISOString() : null,
      endsAt: form.get('endsAt') ? new Date(String(form.get('endsAt'))).toISOString() : null,
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/banners/${editing.id}` : '/api/admin/banners',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ذخیره ناموفق بود.');
        return;
      }
      toast.success(editing ? 'بنر به‌روزرسانی شد.' : 'بنر جدید اضافه شد.');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('این بنر حذف شود؟')) return;
    try {
      const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'حذف ناموفق بود.');
        return;
      }
      toast.success('بنر حذف شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    }
  }

  const preview = initial.filter((b) => b.isActive);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-brand-800">بنرها</h2>
            <p className="mt-1 text-[11px] leading-6 text-brand-400">
              بنرها در بالای صفحه‌ی اصلی به‌ترتیب چیدمان می‌چرخند. بازه‌ی تاریخی اختیاری است؛
              خارج از آن بنر نمایش داده نمی‌شود.
            </p>
          </div>
          <button type="button" onClick={openNew} className="btn-accent btn-sm shrink-0">
            <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            بنر جدید
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {initial.length === 0 ? (
            <p className="py-8 text-center text-xs font-bold text-brand-300">
              هنوز بنری اضافه نشده است.
            </p>
          ) : (
            initial.map((b) => (
              <div
                key={b.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-brand-100 bg-surface-muted p-3',
                  !b.isActive && 'opacity-60',
                )}
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-brand-800">{b.title}</p>
                  <p className="num mt-0.5 truncate text-[10px] font-semibold text-brand-400">
                    ترتیب {toFaDigits(b.sortOrder)}
                    {b.linkUrl ? ` · ${b.linkUrl}` : ''}
                  </p>
                </div>
                {!b.isActive && <span className="badge-muted shrink-0">غیرفعال</span>}
                <button type="button" onClick={() => openEdit(b)} className="btn-ghost btn-sm shrink-0">
                  ویرایش
                </button>
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  className="btn-sm shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10"
                >
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* آیتم grid به‌طور پیش‌فرض min-width:auto دارد و کوچک‌تر از محتوایش
          نمی‌شود؛ بدون min-w-0 این کارت روی گوشی صفحه را به پهنا می‌کشد */}
      <section className="card min-w-0 p-5">
        <h2 className="text-sm font-extrabold text-brand-800">پیش‌نمایش زنده</h2>
        <p className="mt-1 text-[11px] text-brand-400">دقیقاً همان چیزی که بازیکن می‌بیند.</p>
        <div className="mx-auto mt-4 w-full max-w-[380px]">
          {preview.length > 0 ? (
            <BannerCarousel
              banners={preview.map((b) => ({
                id: b.id,
                title: b.title,
                subtitle: b.subtitle,
                imageUrl: b.imageUrl,
                linkUrl: null,
              }))}
              interval={4000}
            />
          ) : (
            <div className="flex h-[148px] flex-col items-center justify-center gap-2 rounded-3xl bg-surface-muted text-brand-300">
              <ImageOff className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-xs font-bold">بنر فعالی برای نمایش نیست</p>
            </div>
          )}
        </div>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'ویرایش بنر' : 'بنر جدید'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label" htmlFor="b-title">عنوان</label>
            <input id="b-title" name="title" defaultValue={editing?.title ?? ''} className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="b-sub">زیرعنوان</label>
            <input id="b-sub" name="subtitle" defaultValue={editing?.subtitle ?? ''} className="field" />
          </div>
          <div>
            <span className="label">تصویر بنر</span>
            <input type="hidden" name="imageUrl" value={image ?? ''} readOnly />
            <ImagePicker
              kind="BANNER"
              aspect="wide"
              value={image}
              onChange={setImage}
              label="انتخاب از گالری"
              hint="تصویر افقی و روشن بهتر دیده می‌شود؛ متن بنر روی سمت راست آن می‌نشیند."
            />
          </div>
          <div>
            <label className="label" htmlFor="b-link">لینک مقصد (اختیاری)</label>
            <input
              id="b-link" name="linkUrl" defaultValue={editing?.linkUrl ?? ''} dir="ltr"
              className="field text-left" placeholder="/tournaments"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="b-start">نمایش از</label>
              <input
                id="b-start" name="startsAt" type="datetime-local" dir="ltr"
                className="field text-left" defaultValue={toLocalInput(editing?.startsAt ?? '')}
              />
            </div>
            <div>
              <label className="label" htmlFor="b-end">نمایش تا</label>
              <input
                id="b-end" name="endsAt" type="datetime-local" dir="ltr"
                className="field text-left" defaultValue={toLocalInput(editing?.endsAt ?? '')}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="b-order">ترتیب نمایش</label>
            <input
              id="b-order" name="sortOrder" type="number" dir="ltr"
              className="field num text-left" defaultValue={editing?.sortOrder ?? 0} min={0} max={999}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <input
              type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            <span className="text-xs font-bold text-brand-600">این بنر فعال باشد</span>
          </label>

          <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
            {loading ? <Spinner /> : editing ? 'ذخیره تغییرات' : 'افزودن بنر'}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
