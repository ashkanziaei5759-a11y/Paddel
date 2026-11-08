'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';

interface Candidate {
  id: string;
  name: string;
  username: string;
}

/**
 * حذف گروهی کاربران فهرست فعلی (مثلاً حساب‌های آزمایشی).
 * مدیرهای کل در فهرست نمی‌آیند؛ برای تأیید باید کلمه‌ی «حذف» تایپ شود.
 */
export function BulkDeleteUsers({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => candidates.map((c) => c.id), [candidates]);
  const allPicked = picked.size === all.length && all.length > 0;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...picked], confirm: typed.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'حذف انجام نشد.');
      const { deleted, failed } = json.data as { deleted: string[]; failed: { error: string }[] };
      if (failed.length) toast.error(`${toFaDigits(failed.length)} کاربر حذف نشد: ${failed[0].error}`);
      if (deleted.length) toast.success(`${toFaDigits(deleted.length)} کاربر حذف شد.`);
      setOpen(false);
      setPicked(new Set());
      setTyped('');
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline btn-sm text-danger">
        <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        حذف گروهی کاربران
      </button>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="حذف گروهی کاربران">
        <div className="space-y-3">
          <p className="text-[11.5px] font-semibold leading-6 text-brand-400">
            حساب، کیف پول و همه‌ی سوابق کاربران انتخاب‌شده برای همیشه پاک می‌شود. مدیرهای کل در این
            فهرست نیستند.
          </p>
          <label className="flex items-center gap-2 text-[11.5px] font-extrabold text-brand-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set(all))}
            />
            انتخاب همه ({toFaDigits(candidates.length)} نفر)
          </label>
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-surface-muted p-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[11.5px] font-bold text-brand-700 hover:bg-card">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={picked.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span dir="ltr" className="num shrink-0 text-[10px] text-brand-300">
                    @{c.username}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <label className="label" htmlFor="bulk-confirm">برای تأیید بنویسید: حذف</label>
            <input
              id="bulk-confirm"
              className="field"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || picked.size === 0 || typed.trim() !== 'حذف'}
            className="btn-danger w-full disabled:opacity-50"
          >
            {busy ? <Spinner /> : `حذف ${toFaDigits(picked.size)} کاربر`}
          </button>
        </div>
      </Sheet>
    </>
  );
}
