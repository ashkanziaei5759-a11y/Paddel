'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toEnDigits, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

const PRESETS = [200_000, 500_000, 1_000_000, 2_000_000];

export function TopupPanel() {
  const toast = useToast();
  const [amount, setAmount] = useState<number>(500_000);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);

  const effective = custom ? Number(toEnDigits(custom).replace(/\D/g, '')) : amount;

  async function startTopup() {
    if (!effective || effective < 10_000) {
      toast.error('حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/payments/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountToman: effective }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ایجاد تراکنش ناموفق بود.');
        return;
      }
      window.location.href = json.data.redirectUrl;
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
      setLoading(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-extrabold text-brand-800">شارژ کیف پول</h2>
      <p className="mt-1 text-[11px] font-semibold text-brand-400">
        مبلغ موردنظر را انتخاب کنید و پرداخت را در درگاه بانکی تکمیل کنید.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => { setAmount(value); setCustom(''); }}
            className={cn(
              'num rounded-2xl border px-3 py-3 text-xs font-extrabold transition-all duration-200',
              !custom && amount === value
                ? 'border-transparent bg-brand-gradient text-white shadow-card'
                : 'border-brand-100 bg-surface-muted text-brand-600 hover:border-brand-200 hover:bg-card',
            )}
          >
            {toFaDigits(value.toLocaleString('en-US'))}
            <span className="mr-1 text-[10px] font-bold opacity-70">تومان</span>
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label className="label" htmlFor="custom-amount">یا مبلغ دلخواه (تومان)</label>
        <input
          id="custom-amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d۰-۹٠-٩]/g, ''))}
          inputMode="numeric"
          dir="ltr"
          className="field num text-left"
          placeholder="750000"
        />
      </div>

      <button type="button" onClick={startTopup} disabled={loading} className="btn-accent btn-lg mt-4 w-full">
        {loading ? <Spinner /> : `پرداخت ${toFaDigits((effective || 0).toLocaleString('en-US'))} تومان`}
      </button>
    </section>
  );
}
