'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { BOOKING_STATUS_LABEL } from '@/lib/constants';
import { formatDateTime, formatTime, toFaDigits } from '@/lib/datetime';
import { formatToman, rialToToman } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

interface BookingDto {
  id: string;
  code: string;
  startsAt: string;
  endsAt: string;
  slotCount: number;
  status: keyof typeof BOOKING_STATUS_LABEL;
  totalPrice: string;
  courtName: string;
  userName: string;
  username: string;
  userId: string;
  refundAmount: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'badge-success',
  PENDING: 'badge-accent',
  CANCELLED: 'badge-danger',
  COMPLETED: 'badge-brand',
  NO_SHOW: 'badge-muted',
};

export function AdminBookingRow({ booking }: { booking: BookingDto }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualRefund, setManualRefund] = useState('');

  const canCancel = booking.status === 'CONFIRMED' || booking.status === 'PENDING';

  async function cancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: String(form.get('reason') || '') || undefined,
          overrideRefundToman: manualRefund ? Number(manualRefund) : undefined,
          adjustmentNote: String(form.get('note') || '') || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) { toast.error(json.error || 'لغو رزرو ناموفق بود.'); return; }

      toast.success(`رزرو لغو شد. مبلغ ${formatToman(BigInt(json.data.refundAmount))} بازگشت داده شد.`);
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
      <div className="flex items-center gap-3 p-3.5">
        <div className="num flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <span className="text-[11px] font-black">{formatTime(new Date(booking.startsAt))}</span>
          <span className="text-[9px] font-bold text-brand-300">
            {toFaDigits(booking.slotCount)} سانس
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/users/${booking.userId}`}
            className="truncate text-xs font-extrabold text-brand-800 hover:text-accent-600"
          >
            {booking.userName}
          </Link>
          <p className="num truncate text-[10px] font-semibold text-brand-400">
            {booking.courtName} <Dot />
            {formatDateTime(new Date(booking.startsAt), { withWeekday: false })}
          </p>
          <p className="num mt-0.5 text-[10px] font-bold text-brand-300">{booking.code}</p>
        </div>

        <div className="shrink-0 text-left">
          <p className="num text-xs font-black text-brand-700">
            {formatToman(BigInt(booking.totalPrice), { withUnit: false })}
          </p>
          {booking.refundAmount && BigInt(booking.refundAmount) > 0n && (
            <p className="num text-[9px] font-bold text-success">
              بازگشت {formatToman(BigInt(booking.refundAmount), { withUnit: false })}
            </p>
          )}
        </div>

        <span className={cn('shrink-0', STATUS_STYLE[booking.status])}>
          {BOOKING_STATUS_LABEL[booking.status]}
        </span>

        {canCancel && (
          <button type="button" onClick={() => setOpen(true)} className="btn-sm btn-danger shrink-0">
            لغو
          </button>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="لغو رزرو توسط مدیریت">
        <form onSubmit={cancel} className="space-y-3">
          <div className="rounded-2xl bg-surface-muted p-3 text-xs">
            <p className="font-extrabold text-brand-800">{booking.userName}</p>
            <p className="num mt-1 font-semibold text-brand-400">
              {booking.courtName} <Dot />{formatDateTime(new Date(booking.startsAt))}
            </p>
            <p className="num mt-1 font-bold text-brand-600">
              مبلغ پرداختی: {formatToman(BigInt(booking.totalPrice))}
            </p>
          </div>

          <div>
            <label className="label" htmlFor={`reason-${booking.id}`}>دلیل لغو</label>
            <input
              id={`reason-${booking.id}`} name="reason" className="field"
              placeholder="مثلاً: تعمیرات زمین"
            />
          </div>

          <div>
            <label className="label" htmlFor={`refund-${booking.id}`}>
              مبلغ بازگشتی دستی (تومان) — اختیاری
            </label>
            <input
              id={`refund-${booking.id}`} value={manualRefund}
              onChange={(e) => setManualRefund(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" dir="ltr" className="field num text-left"
              placeholder={`خالی = محاسبه خودکار (حداکثر ${rialToToman(BigInt(booking.totalPrice))})`}
            />
            <p className="helper">
              اگر خالی بماند، مبلغ بازگشتی طبق پله‌های جریمه‌ی باشگاه محاسبه می‌شود.
            </p>
          </div>

          <div>
            <label className="label" htmlFor={`note-${booking.id}`}>یادداشت اصلاح</label>
            <input id={`note-${booking.id}`} name="note" className="field" placeholder="توضیح داخلی" />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1">
              انصراف
            </button>
            <button type="submit" disabled={loading} className="btn-danger flex-1">
              {loading ? <Spinner /> : 'تأیید لغو'}
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
