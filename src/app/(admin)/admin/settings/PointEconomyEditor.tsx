'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';

/**
 * نرخ اقتصاد امتیاز.
 *
 * یک نرخ برای هر دو کاربرد: تبدیل امتیاز به موجودی توسط مدیر، و پرداخت
 * هزینه‌ی رزرو با امتیاز. اگر دو نرخ جدا بود، اختلافشان راه سوءاستفاده
 * می‌شد — خرید ارزان از یک سمت و نقد کردن گران از سمت دیگر.
 */
export function PointEconomyEditor({
  tomanPerPoint,
  maxConvertPerOperation,
}: {
  tomanPerPoint: number;
  maxConvertPerOperation: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState(String(tomanPerPoint));
  const [cap, setCap] = useState(String(maxConvertPerOperation));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/point-economy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tomanPerPoint: Number(rate),
          maxConvertPerOperation: Number(cap),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'ذخیره نشد.');
      toast.success('نرخ امتیاز ذخیره شد.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-extrabold text-brand-800">اقتصاد امتیاز</h2>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          ارزش هر امتیاز. همین نرخ هم برای تبدیل امتیاز به موجودی به کار می‌رود و هم وقتی
          بازیکن هزینه‌ی رزرو را با امتیاز می‌پردازد.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rate">
          ارزش هر امتیاز (تومان)
        </label>
        <input
          id="rate"
          type="number"
          dir="ltr"
          min={1}
          required
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="field num text-left"
        />
        <p className="num mt-1 text-[10.5px] font-bold text-brand-300">
          یعنی {toFaDigits(100)} امتیاز ={' '}
          {toFaDigits((Number(rate) || 0) * 100).toLocaleString()} تومان
        </p>
      </div>

      <div>
        <label className="label" htmlFor="cap">
          سقف امتیاز در هر تبدیل
        </label>
        <input
          id="cap"
          type="number"
          dir="ltr"
          min={1}
          required
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          className="field num text-left"
        />
        <p className="mt-1 text-[10.5px] font-semibold text-brand-300">
          جلوی یک اشتباه بزرگ در یک عملیات را می‌گیرد.
        </p>
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? <Spinner /> : 'ذخیره نرخ'}
      </button>
    </form>
  );
}
