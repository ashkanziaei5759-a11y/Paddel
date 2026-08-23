'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function CourtCreateButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch('/api/admin/courts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          description: String(form.get('description') || '') || null,
          basePriceToman: String(form.get('basePriceToman') || ''),
          slotDurationMinutes: Number(form.get('slotDurationMinutes')),
          openingMinute: toMinutes(String(form.get('opening') || '10:00')),
          closingMinute: toMinutes(String(form.get('closing') || '23:00')),
          maxConsecutiveSlots: Number(form.get('maxConsecutiveSlots')),
          minLeadTimeMinutes: Number(form.get('minLeadTimeMinutes')),
          advanceBookingDays: Number(form.get('advanceBookingDays')),
          isActive: true,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) { toast.error(json.error || 'ایجاد زمین ناموفق بود.'); return; }

      toast.success('زمین جدید ایجاد شد.');
      setOpen(false);
      router.refresh();
      router.push(`/admin/courts/${json.data.id}`);
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent btn-sm">
        + زمین جدید
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="ایجاد زمین جدید">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label" htmlFor="name">نام زمین</label>
            <input id="name" name="name" className="field" placeholder="زمین ۴" required />
          </div>

          <div>
            <label className="label" htmlFor="description">توضیح</label>
            <input id="description" name="description" className="field" placeholder="زمین سرپوشیده" />
          </div>

          <div>
            <label className="label" htmlFor="basePriceToman">قیمت پایه هر سانس (تومان)</label>
            <input
              id="basePriceToman" name="basePriceToman" inputMode="numeric" dir="ltr"
              className="field num text-left" defaultValue="400000" required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="opening">ساعت شروع</label>
              <input id="opening" name="opening" type="time" dir="ltr" className="field text-left" defaultValue="10:00" />
            </div>
            <div>
              <label className="label" htmlFor="closing">ساعت پایان</label>
              <input id="closing" name="closing" type="time" dir="ltr" className="field text-left" defaultValue="23:00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="slotDurationMinutes">مدت سانس (دقیقه)</label>
              <input
                id="slotDurationMinutes" name="slotDurationMinutes" type="number" dir="ltr"
                className="field num text-left" defaultValue={90} min={15} max={240} step={15}
              />
            </div>
            <div>
              <label className="label" htmlFor="maxConsecutiveSlots">حداکثر سانس پیوسته</label>
              <input
                id="maxConsecutiveSlots" name="maxConsecutiveSlots" type="number" dir="ltr"
                className="field num text-left" defaultValue={4} min={1} max={12}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="minLeadTimeMinutes">حداقل فاصله تا رزرو (دقیقه)</label>
              <input
                id="minLeadTimeMinutes" name="minLeadTimeMinutes" type="number" dir="ltr"
                className="field num text-left" defaultValue={30} min={0} max={1440}
              />
            </div>
            <div>
              <label className="label" htmlFor="advanceBookingDays">رزرو تا چند روز آینده</label>
              <input
                id="advanceBookingDays" name="advanceBookingDays" type="number" dir="ltr"
                className="field num text-left" defaultValue={30} min={1} max={180}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
            {loading ? <Spinner /> : 'ایجاد زمین'}
          </button>
        </form>
      </Sheet>
    </>
  );
}

function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
