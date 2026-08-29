'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dot } from '@/components/ui/Dot';
import { formatJalaliDate, toFaDigits } from '@/lib/datetime';
import { formatNumber, cn } from '@/lib/utils';

export interface MediaRow {
  id: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  createdAt: string;
  uploader: string;
  inUse: boolean;
}

const KIND_LABEL: Record<string, string> = {
  AVATAR: 'عکس پروفایل',
  BANNER: 'بنر',
  ARTICLE_COVER: 'کاور خبر',
  COURT: 'زمین',
  PRODUCT: 'کالا',
};

/** بایت به واحد خوانا */
function size(bytes: number) {
  if (bytes < 1024) return `${toFaDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toFaDigits(Math.round(bytes / 1024))} کیلوبایت`;
  return `${toFaDigits((bytes / 1024 / 1024).toFixed(1))} مگابایت`;
}

export function MediaLibrary({
  rows,
  totals,
}: {
  rows: MediaRow[];
  totals: { kind: string; count: number; bytes: number }[];
}) {
  const [filter, setFilter] = useState<'ALL' | 'UNUSED'>('ALL');
  const list = useMemo(
    () => (filter === 'UNUSED' ? rows.filter((r) => !r.inUse) : rows),
    [rows, filter],
  );

  const totalBytes = totals.reduce((sum, t) => sum + t.bytes, 0);
  const totalCount = totals.reduce((sum, t) => sum + t.count, 0);
  const unused = rows.filter((r) => !r.inUse).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="تعداد تصویر" value={toFaDigits(totalCount)} />
        <Stat label="فضای اشغال‌شده" value={size(totalBytes)} />
        <Stat label="بدون استفاده" value={toFaDigits(unused)} tone={unused > 0 ? 'warn' : undefined} />
        <Stat label="میانگین حجم" value={totalCount ? size(Math.round(totalBytes / totalCount)) : '—'} />
      </div>

      <div className="card p-4">
        <p className="mb-3 text-[11px] font-black text-brand-400">به تفکیک نوع</p>
        <div className="space-y-2">
          {totals.map((t) => (
            <div key={t.kind} className="flex items-center gap-3 text-[11.5px]">
              <span className="w-24 shrink-0 font-bold text-brand-600">
                {KIND_LABEL[t.kind] ?? t.kind}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-electric-gradient"
                  style={{ width: `${totalBytes ? Math.max(3, (t.bytes / totalBytes) * 100) : 0}%` }}
                />
              </div>
              <span className="num w-24 shrink-0 font-bold text-brand-400">
                <bdi>{toFaDigits(t.count)}</bdi>
                <Dot />
                <bdi>{size(t.bytes)}</bdi>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {(['ALL', 'UNUSED'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'rounded-2xl px-4 py-2.5 text-xs font-black transition',
              filter === f ? 'bg-primary text-on-primary' : 'bg-surface-muted text-brand-400',
            )}
          >
            {f === 'ALL' ? `همه (${toFaDigits(rows.length)})` : `بدون استفاده (${toFaDigits(unused)})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="notification" title="تصویری نیست" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((row) => (
            <Card key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="card p-4">
      <p className="text-[10.5px] font-bold text-brand-400">{label}</p>
      <p className={cn('num mt-1.5 text-sm font-black', tone === 'warn' ? 'text-warning' : 'text-brand-800')}>
        {value}
      </p>
    </div>
  );
}

function Card({ row }: { row: MediaRow }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (row.inUse && !confirm('این تصویر همین حالا در اپ استفاده می‌شود. با حذفش، آن جا خالی می‌ماند. ادامه؟')) return;
    if (!row.inUse && !confirm('این تصویر حذف شود؟')) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media/${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'حذف ناموفق بود.');
        return;
      }
      toast.success('تصویر حذف شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="relative aspect-square bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/media/${row.id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
        {!row.inUse && (
          <span className="absolute right-2 top-2 rounded-lg bg-warning px-2 py-0.5 text-[9px] font-black text-on-accent">
            بدون استفاده
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-[11px] font-extrabold text-brand-700">
          {KIND_LABEL[row.kind] ?? row.kind}
        </p>
        <p className="num text-[10px] font-bold text-brand-300">
          {/* ابعاد همیشه چپ‌به‌راست خوانده می‌شود: عرض×ارتفاع */}
          <bdi dir="ltr">
            {toFaDigits(row.width)}×{toFaDigits(row.height)}
          </bdi>
          <Dot />
          <bdi>{size(row.byteSize)}</bdi>
          {row.hasAlpha && (
            <>
              <Dot />
              <span>شفاف</span>
            </>
          )}
        </p>
        <p className="truncate text-[10px] font-semibold text-brand-300">{row.uploader}</p>
        <p className="text-[10px] font-semibold text-brand-300">
          {formatJalaliDate(new Date(row.createdAt))}
        </p>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-danger/10 py-2 text-[10.5px] font-black text-danger transition hover:bg-danger/20"
        >
          {busy ? <Spinner /> : <><Trash2 className="h-3 w-3" />حذف</>}
        </button>
      </div>
    </div>
  );
}
