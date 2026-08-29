'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { ImagePicker } from '@/components/media/ImagePicker';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatJalaliDate, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface AdminArticleDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  isPinned: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
}

const BLANK: AdminArticleDto = {
  id: '', slug: '', title: '', excerpt: '', body: '', coverUrl: '',
  status: 'DRAFT', isPinned: false, viewCount: 0, publishedAt: null, createdAt: '',
};

export function NewsManager({ articles }: { articles: AdminArticleDto[] }) {
  const [editing, setEditing] = useState<AdminArticleDto | null>(null);

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setEditing(BLANK)} className="btn-accent w-full">
        <Plus className="h-4 w-4" />
        مطلب تازه
      </button>

      {articles.length === 0 ? (
        <EmptyState
          icon="notification"
          title="هنوز مطلبی نساخته‌اید"
          description="اولین خبر باشگاه را بنویسید تا در صفحه‌ی اصلی بازیکنان دیده شود."
        />
      ) : (
        <div className="space-y-2.5">
          {articles.map((a) => (
            <Row key={a.id} article={a} onEdit={() => setEditing(a)} />
          ))}
        </div>
      )}

      {editing && (
        <Editor key={editing.id || 'new'} article={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Row({ article, onEdit }: { article: AdminArticleDto; onEdit: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`«${article.title}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/news/${article.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'حذف ناموفق بود.');
        return;
      }
      toast.success('مطلب حذف شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex items-center gap-3 p-3.5">
      {article.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.coverUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span className="h-14 w-14 shrink-0 rounded-2xl bg-surface-muted" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-extrabold text-brand-800">{article.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={article.status === 'PUBLISHED' ? 'badge-success' : 'badge-muted'}>
            {article.status === 'PUBLISHED' ? 'منتشر شده' : 'پیش‌نویس'}
          </span>
          {article.isPinned && (
            <span className="badge-accent flex items-center gap-1">
              <Pin className="h-2.5 w-2.5" />
              سنجاق
            </span>
          )}
          <span className="num badge-muted flex items-center gap-1">
            <Eye className="h-2.5 w-2.5" />
            {toFaDigits(article.viewCount)}
          </span>
        </div>
        <p className="mt-1.5 text-[10px] font-bold text-brand-300">
          {formatJalaliDate(new Date(article.publishedAt ?? article.createdAt))}
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label="ویرایش"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-muted text-brand-500 transition hover:text-brand-700"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="حذف"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger/10 text-danger transition hover:bg-danger/20"
        >
          {busy ? <Spinner /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Editor({ article, onClose }: { article: AdminArticleDto; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<AdminArticleDto>(article);
  const [saving, setSaving] = useState(false);

  const isNew = !article.id;

  function set<K extends keyof AdminArticleDto>(k: K, v: AdminArticleDto[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(isNew ? '/api/admin/news' : `/api/admin/news/${form.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug || undefined,
          excerpt: form.excerpt || null,
          body: form.body,
          coverUrl: form.coverUrl || null,
          status: form.status,
          isPinned: form.isPinned,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ذخیره ناموفق بود.');
        return;
      }
      toast.success(isNew ? 'مطلب ساخته شد.' : 'مطلب به‌روزرسانی شد.');
      onClose();
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open title={isNew ? 'مطلب تازه' : 'ویرایش مطلب'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="عنوان">
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={140}
            className="field"
            placeholder="مثلاً: گزارش فینال جام تابستانه"
          />
        </Field>

        <Field label="خلاصه (اختیاری)" hint="اگر خالی بماند، از ابتدای متن ساخته می‌شود.">
          <textarea
            value={form.excerpt ?? ''}
            onChange={(e) => set('excerpt', e.target.value)}
            maxLength={300}
            rows={2}
            className="field resize-none py-3"
          />
        </Field>

        <Field label="متن مطلب" hint="یک خط خالی بین پاراگراف‌ها بگذارید.">
          <textarea
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            rows={8}
            className="field resize-none py-3 leading-8"
          />
        </Field>

        <Field label="تصویر کاور (اختیاری)">
          <ImagePicker
            kind="ARTICLE_COVER"
            aspect="wide"
            value={form.coverUrl}
            onChange={(url) => set('coverUrl', url)}
            label="انتخاب از گالری"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {(['DRAFT', 'PUBLISHED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => set('status', st)}
              aria-pressed={form.status === st}
              className={cn(
                'rounded-2xl py-3 text-xs font-black transition',
                form.status === st
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-muted text-brand-400',
              )}
            >
              {st === 'DRAFT' ? 'پیش‌نویس' : 'منتشر شود'}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(e) => set('isPinned', e.target.checked)}
            className="h-5 w-5 rounded-md accent-brand-700"
          />
          <span className="text-xs font-extrabold text-brand-700">در بالای فهرست سنجاق شود</span>
        </label>

        <button type="button" onClick={save} disabled={saving} className="btn-accent w-full">
          {saving ? <Spinner /> : isNew ? 'ساخت مطلب' : 'ذخیره تغییرات'}
        </button>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-black text-brand-400">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-[10px] font-semibold text-brand-300">{hint}</p>}
    </div>
  );
}
