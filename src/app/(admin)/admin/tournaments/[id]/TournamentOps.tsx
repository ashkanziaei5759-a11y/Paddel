'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';
import { Dot } from '@/components/ui/Dot';

export function TournamentOps({
  tournamentId,
  type,
  status,
  teamCount,
  matchCount,
  hasResults,
}: {
  tournamentId: string;
  type: string;
  status: string;
  teamCount: number;
  matchCount: number;
  hasResults: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, url: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(key);
    try {
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast.error(json.error || 'عملیات ناموفق بود.'); return; }

      if (key === 'generate') toast.success(`${toFaDigits(json.data.matchCount)} مسابقه ساخته شد.`);
      else if (key === 'advance') toast.success('صعودکنندگان به مرحله حذفی منتقل شدند.');
      else if (key === 'finalize') {
        toast.success(
          `تورنومنت پایان یافت و امتیاز ${toFaDigits(json.data.awardedCount)} بازیکن ثبت شد.`,
        );
      }
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-extrabold text-brand-800">عملیات تورنومنت</h2>
      <p className="mt-1 text-[11px] leading-6 text-brand-400">
        {toFaDigits(teamCount)} تیم ثبت‌نام‌شده <Dot />{toFaDigits(matchCount)} مسابقه ساخته شده
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy !== null || teamCount < 2}
          onClick={() =>
            run(
              'generate',
              `/api/admin/tournaments/${tournamentId}/schedule?action=generate`,
              matchCount > 0
                ? 'ساخت دوباره‌ی جدول، تمام مسابقات و نتایج ثبت‌شده را پاک می‌کند. ادامه می‌دهید؟'
                : undefined,
            )
          }
          className="btn-primary"
        >
          {busy === 'generate' ? <Spinner /> : matchCount > 0 ? 'ساخت مجدد جدول' : 'ساخت جدول مسابقات'}
        </button>

        {type === 'GROUP_KNOCKOUT' && (
          <button
            type="button"
            disabled={busy !== null || matchCount === 0}
            onClick={() => run('advance', `/api/admin/tournaments/${tournamentId}/schedule?action=advance`)}
            className="btn-outline"
          >
            {busy === 'advance' ? <Spinner /> : 'انتقال به مرحله حذفی'}
          </button>
        )}

        <button
          type="button"
          disabled={busy !== null || teamCount < 2 || status === 'CANCELLED'}
          onClick={() =>
            run(
              'finalize',
              `/api/admin/tournaments/${tournamentId}/finalize`,
              'رتبه‌های نهایی محاسبه و امتیازها به بازیکنان تیم‌های برتر اعطا می‌شود. ادامه می‌دهید؟',
            )
          }
          className="btn-accent"
        >
          {busy === 'finalize' ? <Spinner /> : hasResults ? 'به‌روزرسانی نتایج نهایی' : 'پایان و اعطای امتیاز'}
        </button>
      </div>

      <ul className="mt-4 space-y-1.5 text-[11px] leading-6 text-brand-400">
        <li>• ساخت جدول برای لیگ، برنامه‌ی دوره‌ای و برای گروهی+حذفی، گروه‌ها و اسکلت براکت را می‌سازد.</li>
        <li>• پس از پایان مرحله‌ی گروهی، با «انتقال به مرحله حذفی» تیم‌های صعودکننده در براکت قرار می‌گیرند.</li>
        <li>• «پایان و اعطای امتیاز» رتبه‌ها را محاسبه و امتیازها را ثبت می‌کند؛ اجرای دوباره امتیاز تکراری نمی‌دهد.</li>
      </ul>
    </section>
  );
}
