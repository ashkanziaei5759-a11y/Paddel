'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatToman } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

interface PendingRequest {
  id: string;
  isSender: boolean;
  otherName: string;
}

export function RegisterPanel({
  tournamentId,
  status,
  partnerMode,
  isRegistered,
  myTeamName,
  myPartnerName,
  entryFee,
  isFull,
  levelRuleText,
  pendingRequest,
}: {
  tournamentId: string;
  status: string;
  partnerMode: string;
  isRegistered: boolean;
  myTeamName: string | null;
  myPartnerName: string | null;
  entryFee: string;
  isFull: boolean;
  levelRuleText: string;
  pendingRequest: PendingRequest | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // ---- در تیم ثبت‌نام شده ----
  if (isRegistered) {
    return (
      <section className="card bg-success/[.04] p-4 ring-1 ring-success/20">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-xl">
            ✅
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-success">ثبت‌نام شما نهایی شده است</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-brand-500">
              تیم {myTeamName}
              {myPartnerName && (
                <>
                  <Dot />
                  {`پارتنر: ${myPartnerName}`}
                </>
              )}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ---- درخواست پارتنری در جریان ----
  if (pendingRequest) {
    return (
      <section className="card bg-accent-50/70 p-4 ring-1 ring-accent/25">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-xl">
            ⏳
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-accent-700">
              {pendingRequest.isSender
                ? 'در انتظار پاسخ پارتنر'
                : 'درخواست پارتنری برای شما ارسال شده'}
            </p>
            <p className="mt-1 truncate text-[11px] font-semibold text-accent-600">
              {pendingRequest.otherName}
            </p>
          </div>
          {!pendingRequest.isSender && (
            <a href="/partner-requests" className="btn-accent btn-sm shrink-0">
              پاسخ
            </a>
          )}
        </div>
      </section>
    );
  }

  const canRegister = status === 'REGISTRATION_OPEN' && !isFull;

  if (!canRegister) {
    return (
      <section className="card p-4">
        <p className="text-center text-[11px] font-bold leading-6 text-brand-400">
          {isFull
            ? 'ظرفیت این تورنومنت تکمیل شده است.'
            : status === 'REGISTRATION_CLOSED'
              ? 'مهلت ثبت‌نام به پایان رسیده است.'
              : status === 'ONGOING'
                ? 'این تورنومنت در حال برگزاری است.'
                : status === 'COMPLETED'
                  ? 'این تورنومنت به پایان رسیده است.'
                  : 'ثبت‌نام هنوز آغاز نشده است.'}
        </p>
      </section>
    );
  }

  if (partnerMode !== 'PLAYER_CHOICE') {
    return (
      <section className="card p-4">
        <p className="text-center text-[11px] font-bold leading-6 text-brand-400">
          {partnerMode === 'LEADER_DRAFT'
            ? 'تیم‌بندی این تورنومنت توسط لیدرها انجام می‌شود. منتظر اعلام مدیریت باشید.'
            : 'تیم‌بندی این تورنومنت توسط مدیریت باشگاه انجام می‌شود.'}
        </p>
      </section>
    );
  }

  async function submit() {
    if (!username.trim()) {
      toast.error('نام کاربری پارتنر را وارد کنید.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/partner-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          receiverUsername: username.trim(),
          message: message.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ارسال درخواست ناموفق بود.');
        return;
      }

      toast.success('درخواست پارتنری ارسال شد. پس از تأیید، ثبت‌نام نهایی می‌شود.');
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
        <h2 className="text-sm font-extrabold text-brand-800">ثبت‌نام در تورنومنت</h2>
        <p className="mt-2 text-[11px] leading-6 text-brand-400">
          پارتنر خود را انتخاب کنید. پس از تأیید او، تیم شما نهایی و هزینه‌ی ثبت‌نام از کیف پول کسر
          می‌شود.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="btn-accent btn-lg mt-4 w-full">
          انتخاب پارتنر و ثبت‌نام
        </button>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="انتخاب پارتنر">
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-muted p-3">
            <p className="text-[10px] font-black text-brand-400">قانون سطح این تورنومنت</p>
            <p className="mt-1 text-[11px] leading-6 text-brand-600">{levelRuleText}</p>
          </div>

          <div>
            <label className="label" htmlFor="partner-username">نام کاربری پارتنر</label>
            <input
              id="partner-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              className="field text-left"
              placeholder="partner_username"
            />
            <p className="helper">نام کاربری بازیکن موردنظر را دقیقاً وارد کنید.</p>
          </div>

          <div>
            <label className="label" htmlFor="partner-message">پیام (اختیاری)</label>
            <textarea
              id="partner-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={240}
              className="field resize-none"
              placeholder="بازی کنیم؟ 🎾"
            />
          </div>

          {BigInt(entryFee) > 0n && (
            <div className="flex items-center justify-between rounded-2xl bg-accent-50 px-4 py-3">
              <span className="text-[11px] font-bold text-accent-700">هزینه ثبت‌نام</span>
              <span className="num text-xs font-black text-accent-700">
                {formatToman(BigInt(entryFee))}
              </span>
            </div>
          )}

          <button type="button" onClick={submit} disabled={loading} className="btn-accent btn-lg w-full">
            {loading ? <Spinner /> : 'ارسال درخواست پارتنری'}
          </button>
        </div>
      </Sheet>
    </>
  );
}
