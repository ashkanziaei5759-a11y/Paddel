'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImagePicker } from '@/components/media/ImagePicker';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { rialToToman } from '@/lib/utils';

interface CourtDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  basePrice: string;
  slotDurationMinutes: number;
  openingMinute: number;
  closingMinute: number;
  maxConsecutiveSlots: number;
  minLeadTimeMinutes: number;
  advanceBookingDays: number;
  sortOrder: number;
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

export function CourtEditor({ court }: { court: CourtDto }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(court.isActive);
  const [image, setImage] = useState<string | null>(court.imageUrl ?? null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch(`/api/admin/courts/${court.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          description: String(form.get('description') || '') || null,
          imageUrl: String(form.get('imageUrl') || '') || null,
          isActive,
          basePriceToman: String(form.get('basePriceToman') || ''),
          slotDurationMinutes: Number(form.get('slotDurationMinutes')),
          openingMinute: toMinutes(String(form.get('opening') || '')),
          closingMinute: toMinutes(String(form.get('closing') || '')),
          maxConsecutiveSlots: Number(form.get('maxConsecutiveSlots')),
          minLeadTimeMinutes: Number(form.get('minLeadTimeMinutes')),
          advanceBookingDays: Number(form.get('advanceBookingDays')),
          sortOrder: Number(form.get('sortOrder')),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) { toast.error(json.error || 'ذخیره ناموفق بود.'); return; }

      toast.success('مشخصات زمین به‌روزرسانی شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-brand-800">مشخصات زمین</h2>
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className={`relative h-7 w-12 rounded-full transition-colors ${isActive ? 'bg-success' : 'bg-brand-200'}`}
          aria-label={isActive ? 'غیرفعال کردن زمین' : 'فعال کردن زمین'}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-all ${isActive ? 'right-1' : 'right-6'}`}
          />
        </button>
      </div>
      <p className="-mt-1 text-[11px] font-bold text-brand-400">
        وضعیت: {isActive ? 'فعال — قابل رزرو' : 'غیرفعال — از فهرست رزرو حذف می‌شود'}
      </p>

      <div>
        <label className="label" htmlFor="name">نام زمین</label>
        <input id="name" name="name" defaultValue={court.name} className="field" required />
      </div>

      <div>
        <label className="label" htmlFor="description">توضیح</label>
        <input id="description" name="description" defaultValue={court.description ?? ''} className="field" />
      </div>

      <div>
        <span className="label">تصویر زمین</span>
        {/* فرم با FormData خوانده می‌شود، پس مقدار در یک ورودی پنهان می‌ماند */}
        <input type="hidden" name="imageUrl" value={image ?? ''} readOnly />
        <ImagePicker kind="COURT" aspect="wide" value={image} onChange={setImage} label="انتخاب از گالری" />
      </div>

      <div>
        <label className="label" htmlFor="basePriceToman">قیمت پایه هر سانس (تومان)</label>
        <input
          id="basePriceToman" name="basePriceToman" inputMode="numeric" dir="ltr"
          className="field num text-left" defaultValue={rialToToman(BigInt(court.basePrice))} required
        />
        <p className="helper">این قیمت وقتی اعمال می‌شود که هیچ قانون قیمت‌گذاری بازه‌ای مطابقت نداشته باشد.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="opening">ساعت شروع</label>
          <input
            id="opening" name="opening" type="time" dir="ltr" className="field text-left"
            defaultValue={toTimeInput(court.openingMinute)}
          />
        </div>
        <div>
          <label className="label" htmlFor="closing">ساعت پایان</label>
          <input
            id="closing" name="closing" type="time" dir="ltr" className="field text-left"
            defaultValue={toTimeInput(court.closingMinute)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="slotDurationMinutes">مدت هر سانس (دقیقه)</label>
          <input
            id="slotDurationMinutes" name="slotDurationMinutes" type="number" dir="ltr"
            className="field num text-left" defaultValue={court.slotDurationMinutes}
            min={15} max={240} step={15}
          />
        </div>
        <div>
          <label className="label" htmlFor="maxConsecutiveSlots">حداکثر سانس پیوسته</label>
          <input
            id="maxConsecutiveSlots" name="maxConsecutiveSlots" type="number" dir="ltr"
            className="field num text-left" defaultValue={court.maxConsecutiveSlots} min={1} max={12}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="minLeadTimeMinutes">حداقل فاصله (دقیقه)</label>
          <input
            id="minLeadTimeMinutes" name="minLeadTimeMinutes" type="number" dir="ltr"
            className="field num text-left" defaultValue={court.minLeadTimeMinutes} min={0} max={1440}
          />
        </div>
        <div>
          <label className="label" htmlFor="advanceBookingDays">افق رزرو (روز)</label>
          <input
            id="advanceBookingDays" name="advanceBookingDays" type="number" dir="ltr"
            className="field num text-left" defaultValue={court.advanceBookingDays} min={1} max={180}
          />
        </div>
        <div>
          <label className="label" htmlFor="sortOrder">ترتیب نمایش</label>
          <input
            id="sortOrder" name="sortOrder" type="number" dir="ltr"
            className="field num text-left" defaultValue={court.sortOrder} min={0} max={999}
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Spinner /> : 'ذخیره مشخصات'}
      </button>
    </form>
  );
}
