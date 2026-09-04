'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { LEVEL_LABEL } from '@/lib/constants';
import type { PlayerLevel } from '@prisma/client';

export interface PendingPlayer {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  level: PlayerLevel | null;
}

/**
 * صف تأیید میزبان.
 *
 * جای بازیکنِ در انتظار از همان لحظه‌ی درخواست رزرو است و سهمش گرفته شده؛
 * پس «رد کردن» علاوه بر آزاد کردن جا، پول را هم برمی‌گرداند. متن دکمه‌ها این
 * را صریح می‌گوید تا میزبان بداند رد کردن ضرری به بازیکن نمی‌زند.
 */
export function PendingRequests({
  matchId,
  players,
}: {
  matchId: string;
  players: PendingPlayer[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (players.length === 0) return null;

  async function decide(userId: string, action: 'APPROVE' | 'REJECT') {
    setBusy(userId);
    try {
      const res = await fetch(`/api/matches/${matchId}/players/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'انجام نشد.');
      toast.success(action === 'APPROVE' ? 'بازیکن تأیید شد.' : 'درخواست رد شد و سهمش بازگشت.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'انجام نشد.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-extrabold text-brand-800">در انتظار تأیید شما</h2>
      <p className="mt-1 text-[11px] font-semibold leading-6 text-brand-400">
        جای این بازیکن‌ها رزرو شده و سهمشان گرفته شده است. اگر رد کنید، سهم کامل به کیف
        پولشان بازمی‌گردد و جا آزاد می‌شود.
      </p>

      <ul className="mt-3 space-y-2.5">
        {players.map((p) => (
          <li
            key={p.userId}
            className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-surface-muted p-3"
          >
            <Avatar
              firstName={p.firstName}
              lastName={p.lastName}
              src={p.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-brand-800">
                {p.firstName} {p.lastName}
              </p>
              {p.level && (
                <span dir="ltr" className="mt-0.5 block text-[10px] font-black text-brand-300">
                  {LEVEL_LABEL[p.level]}
                </span>
              )}
            </div>

            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => decide(p.userId, 'APPROVE')}
                disabled={busy !== null}
                aria-label={`تأیید ${p.firstName} ${p.lastName}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success transition hover:bg-success/25 disabled:opacity-50"
              >
                {busy === p.userId ? <Spinner /> : <Check className="h-4 w-4" strokeWidth={2.6} />}
              </button>
              <button
                type="button"
                onClick={() => decide(p.userId, 'REJECT')}
                disabled={busy !== null}
                aria-label={`رد ${p.firstName} ${p.lastName}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger/10 text-danger transition hover:bg-danger/20 disabled:opacity-50"
              >
                <X className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
