'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';

export function CancelBookingPanel({
  bookingId,
  totalPrice,
  refundAmount,
  penaltyPercent,
  policyName,
}: {
  bookingId: string;
  totalPrice: string;
  refundAmount: string;
  penaltyPercent: number;
  policyName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  async function cancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'لغو رزرو ناموفق بود.');
        return;
      }

      toast.success(
        BigInt(json.data.refundAmount) > 0n
          ? `رزرو لغو شد و ${formatToman(BigInt(json.data.refundAmount))} به کیف پول شما بازگشت.`
          : 'رزرو شما لغو شد.',
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card p-4">
        <h2 className="text-sm font-extrabold text-brand-800">لغو رزرو</h2>
        <p className="mt-2 text-[11px] font-semibold leading-6 text-brand-400">
          طبق قوانین باشگاه، در صورت لغو در این بازه ({policyName}){' '}
          <span className="font-black text-brand-700">{toFaDigits(penaltyPercent)}٪</span> از مبلغ کسر
          می‌شود.
        </p>

        <div className="mt-3 space-y-2 rounded-2xl bg-surface-muted p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-400">مبلغ پرداختی</span>
            <span className="num font-bold text-brand-700">{formatToman(BigInt(totalPrice))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-400">مبلغ بازگشتی به کیف پول</span>
            <span className="num font-black text-success">{formatToman(BigInt(refundAmount))}</span>
          </div>
        </div>

        <button type="button" onClick={() => setOpen(true)} className="btn-danger btn-lg mt-4 w-full">
          لغو رزرو
        </button>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="تأیید لغو رزرو">
        <div className="space-y-4">
          <p className="text-xs font-semibold leading-6 text-brand-500">
            آیا از لغو این رزرو مطمئن هستید؟ مبلغ{' '}
            <span className="num font-black text-success">{formatToman(BigInt(refundAmount))}</span> به
            کیف پول شما بازمی‌گردد و این عملیات قابل بازگشت نیست.
          </p>

          <div>
            <label className="label" htmlFor="reason">دلیل لغو (اختیاری)</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={240}
              className="field resize-none"
              placeholder="مثلاً: تغییر برنامه"
            />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1">
              انصراف
            </button>
            <button type="button" onClick={cancel} disabled={loading} className="btn-danger flex-1">
              {loading ? <Spinner /> : 'تأیید لغو'}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
