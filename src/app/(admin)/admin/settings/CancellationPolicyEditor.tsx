'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';

interface PolicyRow {
  name: string;
  minMinutesBefore: number;
  maxMinutesBefore: number | null;
  penaltyPercent: number;
  isActive: boolean;
}

export function CancellationPolicyEditor({ initial }: { initial: PolicyRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<PolicyRow[]>(initial);
  const [saving, setSaving] = useState(false);

  function update(index: number, patch: Partial<PolicyRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { name: 'پله‌ی جدید', minMinutesBefore: 0, maxMinutesBefore: 30, penaltyPercent: 10, isActive: true },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cancellation-policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies: rows }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast.error(json.error || 'ذخیره ناموفق بود.'); return; }
      toast.success('پله‌های جریمه‌ی لغو به‌روزرسانی شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-brand-800">پله‌های جریمه‌ی لغو رزرو</h2>
          <p className="mt-1 text-[11px] leading-6 text-brand-400">
            بر اساس دقیقه‌های باقی‌مانده تا شروع رزرو. پله‌ها باید بدون شکاف و هم‌پوشانی، کل بازه
            را از صفر تا بی‌نهایت بپوشانند.
          </p>
        </div>
        <button type="button" onClick={addRow} className="btn-outline btn-sm shrink-0">
          + پله
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-2xl border border-brand-100 bg-surface-muted p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={row.name}
                onChange={(e) => update(index, { name: e.target.value })}
                className="field flex-1"
                placeholder="عنوان پله"
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold text-danger hover:bg-danger/10"
              >
                حذف
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">از دقیقه</label>
                <input
                  type="number" dir="ltr" className="field num text-left"
                  value={row.minMinutesBefore} min={0}
                  onChange={(e) => update(index, { minMinutesBefore: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">تا دقیقه</label>
                <input
                  type="number" dir="ltr" className="field num text-left"
                  value={row.maxMinutesBefore ?? ''} min={0}
                  placeholder="بی‌نهایت"
                  onChange={(e) =>
                    update(index, {
                      maxMinutesBefore: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">درصد کسر</label>
                <input
                  type="number" dir="ltr" className="field num text-left"
                  value={row.penaltyPercent} min={0} max={100}
                  onChange={(e) => update(index, { penaltyPercent: Number(e.target.value) })}
                />
              </div>
            </div>

            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox" checked={row.isActive}
                onChange={(e) => update(index, { isActive: e.target.checked })}
                className="h-4 w-4 accent-brand-700"
              />
              <span className="text-[11px] font-bold text-brand-500">این پله فعال باشد</span>
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-brand-50/60 p-3 text-[11px] leading-6 text-brand-500">
        پیش‌نمایش: رزروی با {toFaDigits(180)} دقیقه فاصله تا شروع، طبق پله‌ی{' '}
        {rows.find(
          (r) =>
            180 >= r.minMinutesBefore && (r.maxMinutesBefore === null || 180 < r.maxMinutesBefore),
        )?.name ?? '—'}{' '}
        محاسبه می‌شود.
      </div>

      <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
        {saving ? <Spinner /> : 'ذخیره پله‌ها'}
      </button>
    </section>
  );
}
