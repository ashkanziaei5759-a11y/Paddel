'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import type { DeletionSummary } from '@/lib/user-deletion';

/**
 * حذف کامل حساب. پیش از تأیید، آنچه از دست می‌رود (موجودی، رزروها،
 * پرداخت‌ها) نشان داده می‌شود و مدیر باید نام کاربری را تایپ کند.
 */
export function DeleteUserCard({ userId, summary }: { userId: string; summary: DeletionSummary }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const balance = BigInt(summary.walletBalance);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmUsername: typed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'حذف انجام نشد.');
      toast.success(`حساب ${summary.name} حذف شد.`);
      router.replace('/admin/users');
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card border border-danger/20 p-4">
      <h2 className="text-sm font-extrabold text-danger">حذف حساب کاربر</h2>
      <p className="mt-1.5 text-[11.5px] font-semibold leading-6 text-brand-400">
        حساب، کیف پول، تاریخچه‌ی رزرو و همه‌ی داده‌های این کاربر برای همیشه پاک می‌شود و قابل
        بازگشت نیست. رزروهای آینده‌اش اول لغو می‌شوند تا سانس‌ها آزاد شوند.
      </p>
      <button type="button" onClick={() => setOpen(true)} className="btn-danger btn-sm mt-3">
        <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        حذف این کاربر
      </button>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={`حذف ${summary.name}`}>
        <div className="space-y-3">
          <ul className="space-y-1.5 rounded-2xl bg-surface-muted p-3 text-[11.5px] font-bold text-brand-600">
            <li>موجودی کیف پول: <span className="num">{formatToman(balance)}</span></li>
            <li>رزروهای آینده که لغو می‌شوند: <span className="num">{toFaDigits(summary.upcomingBookings)}</span></li>
            <li>رزروهای گذشته که پاک می‌شوند: <span className="num">{toFaDigits(summary.pastBookings)}</span></li>
            <li>پرداخت‌های موفق از درگاه: <span className="num">{toFaDigits(summary.successfulPayments)}</span></li>
          </ul>
          {(balance > 0n || summary.successfulPayments > 0) && (
            <p className="rounded-2xl bg-danger/10 p-3 text-[11px] font-bold leading-6 text-danger">
              این کاربر پول واقعی در کیف پولش دارد یا پرداخت کرده است. اگر باید پولش برگردد، پیش از
              حذف تسویه کنید؛ بعد از حذف، سابقه‌ی مالی‌اش هم پاک می‌شود.
            </p>
          )}
          <div>
            <label className="label" htmlFor="confirm-username">
              برای تأیید، نام کاربری را بنویسید: <span dir="ltr" className="num">{summary.username}</span>
            </label>
            <input
              id="confirm-username"
              dir="ltr"
              autoComplete="off"
              className="field text-left"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-outline flex-1">
              انصراف
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy || typed.trim().toLowerCase() !== summary.username}
              className="btn-danger flex-1 disabled:opacity-50"
            >
              {busy ? <Spinner /> : 'حذف برای همیشه'}
            </button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
