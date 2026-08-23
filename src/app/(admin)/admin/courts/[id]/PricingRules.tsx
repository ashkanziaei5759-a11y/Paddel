'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { WEEKDAYS_FA_SHORT } from '@/lib/jalali';
import { formatMinutes, toFaDigits } from '@/lib/datetime';
import { formatToman, rialToToman } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

interface RuleDto {
  id: string;
  name: string;
  startMinute: number;
  endMinute: number;
  daysOfWeek: number[];
  price: string;
  priority: number;
  isActive: boolean;
}

function toTimeInput(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toMinutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function PricingRules({
  courtId,
  basePrice,
  rules,
}: {
  courtId: string;
  basePrice: string;
  rules: RuleDto[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDto | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  function openNew() {
    setEditing(null);
    setDays([]);
    setOpen(true);
  }

  function openEdit(rule: RuleDto) {
    setEditing(rule);
    setDays(rule.daysOfWeek);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    const payload = {
      name: String(form.get('name') || ''),
      startMinute: toMinutes(String(form.get('start') || '')),
      endMinute: toMinutes(String(form.get('end') || '')),
      daysOfWeek: days,
      priceToman: String(form.get('priceToman') || ''),
      priority: Number(form.get('priority') || 0),
      isActive: form.get('isActive') === 'on',
    };

    try {
      const res = await fetch(
        editing
          ? `/api/admin/courts/${courtId}/pricing/${editing.id}`
          : `/api/admin/courts/${courtId}/pricing`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();

      if (!res.ok || !json.ok) { toast.error(json.error || 'ذخیره ناموفق بود.'); return; }

      toast.success(editing ? 'قانون قیمت‌گذاری به‌روزرسانی شد.' : 'قانون قیمت‌گذاری ایجاد شد.');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function remove(ruleId: string) {
    if (!confirm('این قانون قیمت‌گذاری حذف شود؟')) return;
    try {
      const res = await fetch(`/api/admin/courts/${courtId}/pricing/${ruleId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast.error(json.error || 'حذف ناموفق بود.'); return; }
      toast.success('قانون حذف شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    }
  }

  return (
    <>
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-brand-800">قیمت‌گذاری بازه‌ای</h2>
          <button type="button" onClick={openNew} className="btn-accent btn-sm">
            + قانون جدید
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-6 text-brand-400">
          قیمت پایه‌ی این زمین{' '}
          <span className="num font-black text-brand-700">{formatToman(BigInt(basePrice))}</span> است.
          برای ساعات خاص (مثلاً ۱۶ تا ۲۳) می‌توانید قیمت متفاوتی تعریف کنید. در صورت هم‌پوشانی، قانون با
          اولویت بالاتر برنده است.
        </p>

        <div className="mt-4 space-y-2">
          {rules.length === 0 ? (
            <p className="py-6 text-center text-xs font-bold text-brand-300">
              قانونی تعریف نشده — همه‌ی ساعات با قیمت پایه محاسبه می‌شوند.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'rounded-2xl border border-brand-100 bg-surface-muted p-3',
                  !rule.isActive && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-brand-800">{rule.name}</p>
                    <p className="num mt-1 text-[11px] font-bold text-brand-400">
                      {formatMinutes(rule.startMinute)} تا {formatMinutes(rule.endMinute)}
                      {rule.daysOfWeek.length > 0 &&
                        <>
                          <Dot />
                          {rule.daysOfWeek.map((d) => WEEKDAYS_FA_SHORT[d]).join('،')}
                        </>}
                    </p>
                  </div>
                  <span className="num shrink-0 text-xs font-black text-accent-600">
                    {formatToman(BigInt(rule.price))}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="num badge-muted">اولویت {toFaDigits(rule.priority)}</span>
                  {!rule.isActive && <span className="badge-danger">غیرفعال</span>}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => openEdit(rule)}
                    className="btn-ghost btn-sm"
                  >
                    ویرایش
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(rule.id)}
                    className="btn-sm rounded-xl px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'ویرایش قانون قیمت' : 'قانون قیمت جدید'}
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label" htmlFor="rule-name">عنوان</label>
            <input
              id="rule-name" name="name" defaultValue={editing?.name ?? ''}
              className="field" placeholder="ساعات پرتقاضا (عصر)" required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="rule-start">از ساعت</label>
              <input
                id="rule-start" name="start" type="time" dir="ltr" className="field text-left"
                defaultValue={editing ? toTimeInput(editing.startMinute) : '16:00'} required
              />
            </div>
            <div>
              <label className="label" htmlFor="rule-end">تا ساعت</label>
              <input
                id="rule-end" name="end" type="time" dir="ltr" className="field text-left"
                defaultValue={editing ? toTimeInput(editing.endMinute) : '23:00'} required
              />
            </div>
          </div>

          <div>
            <label className="label">روزهای هفته</label>
            <div className="flex gap-1.5">
              {WEEKDAYS_FA_SHORT.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setDays((prev) =>
                      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
                    )
                  }
                  className={cn(
                    'h-10 flex-1 rounded-xl text-xs font-black transition-all',
                    days.includes(index)
                      ? 'bg-brand-gradient text-white shadow-card'
                      : 'bg-surface-muted text-brand-400 hover:bg-brand-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="helper">اگر هیچ روزی انتخاب نشود، قانون در همه‌ی روزهای هفته اعمال می‌شود.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="rule-price">قیمت هر سانس (تومان)</label>
              <input
                id="rule-price" name="priceToman" inputMode="numeric" dir="ltr"
                className="field num text-left"
                defaultValue={editing ? rialToToman(BigInt(editing.price)) : 500000} required
              />
            </div>
            <div>
              <label className="label" htmlFor="rule-priority">اولویت</label>
              <input
                id="rule-priority" name="priority" type="number" dir="ltr"
                className="field num text-left" defaultValue={editing?.priority ?? 0} min={0} max={100}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <input
              type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true}
              className="h-4 w-4 accent-brand-700"
            />
            <span className="text-xs font-bold text-brand-600">این قانون فعال باشد</span>
          </label>

          <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
            {loading ? <Spinner /> : editing ? 'ذخیره تغییرات' : 'ایجاد قانون'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
