'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PlayerLevel } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { Dot } from '@/components/ui/Dot';
import { LEVEL_LABEL } from '@/lib/constants';
import { formatJalaliDate, formatRelative, formatTime, toFaDigits } from '@/lib/datetime';
import { cn, formatToman } from '@/lib/utils';

export interface MatchPlayerDto {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  level: PlayerLevel | null;
  isHost: boolean;
}

export interface MatchDto {
  id: string;
  code: string;
  courtName: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  share: string;
  levelPolicy: 'ANY' | 'RANGE';
  allowedLevels: PlayerLevel[];
  notes: string | null;
  status: 'OPEN' | 'FULL' | 'COMPLETED' | 'CANCELLED';
  players: MatchPlayerDto[];
}

/**
 * کارت بازی باز — جای خالی‌ها به‌صورت دایره‌های خط‌چین در ادامه‌ی بازیکنان
 * نشان داده می‌شود تا در یک نگاه معلوم باشد چند نفر دیگر لازم است.
 */
export function MatchCard({
  match,
  viewerId,
  compact,
}: {
  match: MatchDto;
  viewerId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<'JOIN' | 'LEAVE' | null>(null);

  const seat = match.players.find((p) => p.userId === viewerId);
  const isHost = seat?.isHost ?? false;
  const empty = Math.max(0, match.capacity - match.players.length);
  const startsAt = new Date(match.startsAt);
  const hoursToStart = (startsAt.getTime() - Date.now()) / 3_600_000;

  async function act(action: 'JOIN' | 'LEAVE') {
    setLoading(action);
    try {
      const res = await fetch(`/api/matches/${match.id}/${action.toLowerCase()}`, { method: 'POST' });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'انجام نشد.');
        return;
      }

      toast.success(
        action === 'JOIN'
          ? json.data.nowFull
            ? 'به بازی پیوستید و ظرفیت تکمیل شد 🎾'
            : 'به بازی پیوستید. سهم شما از کیف پول کسر شد.'
          : `از بازی خارج شدید و ${formatToman(BigInt(json.data.refunded))} به کیف پولتان بازگشت.`,
      );
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={cn('card overflow-hidden p-0', seat && 'ring-1 ring-accent/40')}>
      {/* ---- سربرگ: زمان و زمین ---- */}
      <div className="flex items-center gap-3 border-b border-brand-50 p-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-gradient text-white">
          <span className="num text-base font-black leading-none">{formatTime(startsAt)}</span>
          <span className="mt-1 text-[9px] font-bold text-sky-light/70">
            {formatJalaliDate(startsAt, { short: true })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-brand-800">{match.courtName}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-brand-400">
            {formatJalaliDate(startsAt, { withWeekday: true })}
            <Dot />
            {formatRelative(startsAt)}
          </p>
        </div>

        <span
          className={cn(
            'shrink-0',
            empty === 0 ? 'badge-success' : empty === 1 ? 'badge-accent' : 'badge-brand',
          )}
        >
          {empty === 0 ? 'تکمیل' : `${toFaDigits(empty)} جای خالی`}
        </span>
      </div>

      {/* ---- بازیکنان و جاهای خالی ---- */}
      <div className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          {match.players.map((p) => (
            <div key={p.userId} className="flex w-14 flex-col items-center gap-1.5">
              <div className="relative">
                <Avatar
                  firstName={p.firstName}
                  lastName={p.lastName}
                  src={p.avatarUrl}
                  size="md"
                  className={cn(p.isHost && 'ring-2 ring-accent ring-offset-2 ring-offset-card')}
                />
                {p.level && (
                  <span
                    dir="ltr"
                    className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-lg bg-primary px-1 text-[9px] font-black text-on-primary ring-2 ring-card"
                  >
                    {LEVEL_LABEL[p.level]}
                  </span>
                )}
              </div>
              <span className="w-full truncate text-center text-[10px] font-bold text-brand-600">
                {p.firstName}
              </span>
              {p.isHost && (
                <span className="text-[9px] font-black text-accent-600">میزبان</span>
              )}
            </div>
          ))}

          {Array.from({ length: empty }).map((_, i) => (
            <div key={`empty-${i}`} className="flex w-14 flex-col items-center gap-1.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-brand-200 text-brand-200">
                <Icon name="users" className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="text-[10px] font-bold text-brand-300">خالی</span>
            </div>
          ))}
        </div>

        {/* ---- سهم و شرط سطح ---- */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-muted px-3 py-2.5">
          <span className="num text-xs font-black text-brand-700">
            {formatToman(BigInt(match.share))}
          </span>
          <span className="text-[10px] font-bold text-brand-400">سهم هر نفر</span>
          <span className="flex-1" />
          {match.levelPolicy === 'RANGE' ? (
            <span dir="ltr" className="badge-brand text-[9px]">
              {match.allowedLevels.map((l) => LEVEL_LABEL[l]).join(' · ')}
            </span>
          ) : (
            <span className="badge-muted text-[9px]">همه‌ی سطح‌ها</span>
          )}
        </div>

        {match.notes && !compact && (
          <p className="mt-2 rounded-2xl bg-brand-50/60 px-3 py-2 text-[11px] leading-6 text-brand-500">
            «{match.notes}»
          </p>
        )}

        {/* ---- عمل ---- */}
        {!compact && (
          <div className="mt-3">
            {isHost ? (
              <Link href="/bookings" className="btn-outline btn-sm w-full">
                مدیریت رزرو
              </Link>
            ) : seat ? (
              hoursToStart >= 2 ? (
                <button
                  type="button"
                  onClick={() => act('LEAVE')}
                  disabled={loading !== null}
                  className="btn-outline btn-sm w-full text-danger"
                >
                  {loading === 'LEAVE' ? <Spinner /> : 'خروج از بازی و بازگشت سهم'}
                </button>
              ) : (
                <p className="rounded-2xl bg-surface-muted px-3 py-2.5 text-center text-[11px] font-bold text-brand-400">
                  کمتر از ۲ ساعت به شروع مانده — خروج ممکن نیست.
                </p>
              )
            ) : empty === 0 ? (
              <p className="rounded-2xl bg-surface-muted px-3 py-2.5 text-center text-[11px] font-bold text-brand-400">
                ظرفیت این بازی تکمیل شده است.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => act('JOIN')}
                disabled={loading !== null}
                className="btn-accent btn-sm w-full"
              >
                {loading === 'JOIN' ? (
                  <Spinner />
                ) : (
                  `پیوستن — ${formatToman(BigInt(match.share))}`
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
