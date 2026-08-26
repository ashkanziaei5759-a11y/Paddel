'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlayerLevel } from '@prisma/client';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { Dot } from '@/components/ui/Dot';
import { MatchCard, type MatchDto } from '@/components/match/MatchCard';
import { LEVEL_LABEL, LEVEL_ORDER } from '@/lib/constants';
import { formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { cn, formatToman } from '@/lib/utils';

interface OpenBookingDto {
  id: string;
  courtName: string;
  startsAt: string;
  totalPrice: string;
}

type Tab = 'available' | 'mine';

export function MatchesView({
  matches,
  viewerId,
  viewerLevel,
  openBookings,
}: {
  matches: MatchDto[];
  viewerId: string;
  viewerLevel: PlayerLevel;
  openBookings: OpenBookingDto[];
}) {
  const [tab, setTab] = useState<Tab>('available');
  const [hostSheet, setHostSheet] = useState(false);

  const mine = useMemo(
    () => matches.filter((m) => m.players.some((p) => p.userId === viewerId)),
    [matches, viewerId],
  );

  const available = useMemo(
    () =>
      matches.filter(
        (m) =>
          !m.players.some((p) => p.userId === viewerId) &&
          m.players.length < m.capacity &&
          (m.levelPolicy === 'ANY' || m.allowedLevels.includes(viewerLevel)),
      ),
    [matches, viewerId, viewerLevel],
  );

  const list = tab === 'available' ? available : mine;

  return (
    <div className="space-y-4">
      {/* ---- دعوت به میزبانی ---- */}
      {openBookings.length > 0 && (
        <button
          type="button"
          onClick={() => setHostSheet(true)}
          className="card-night w-full p-4 text-right"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-electric-300">
              <Icon name="users" className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-white">زمین رزروشده دارید — بازی را باز کنید</p>
              <p className="mt-1 text-[11px] font-semibold text-sky-light/65">
                هزینه بین بازیکنان تقسیم می‌شود و سهم شما کم می‌شود.
              </p>
            </div>
            <span className="shrink-0 text-electric-300">‹</span>
          </div>
        </button>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'available', label: 'جای خالی', count: available.length },
          { value: 'mine', label: 'بازی‌های من', count: mine.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon="users"
          title={tab === 'available' ? 'بازی بازی نیست' : 'در بازی‌ای نیستید'}
          description={
            tab === 'available'
              ? 'الان بازی بازی که با سطح شما بخورد وجود ندارد. خودتان زمین رزرو کنید و بازی را باز کنید.'
              : 'به یکی از بازی‌های باز بپیوندید یا زمین خودتان را برای بقیه باز کنید.'
          }
          actionLabel={tab === 'available' ? 'رزرو زمین' : undefined}
          actionHref={tab === 'available' ? '/booking' : undefined}
        />
      ) : (
        <div className="stagger space-y-3">
          {list.map((m) => (
            <MatchCard key={m.id} match={m} viewerId={viewerId} />
          ))}
        </div>
      )}

      <HostSheet open={hostSheet} bookings={openBookings} onClose={() => setHostSheet(false)} />
    </div>
  );
}

/** فرم باز کردن بازی روی یکی از رزروهای کاربر */
function HostSheet({
  open,
  bookings,
  onClose,
}: {
  open: boolean;
  bookings: OpenBookingDto[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? '');
  const [capacity, setCapacity] = useState(4);
  const [restrict, setRestrict] = useState(false);
  const [levels, setLevels] = useState<PlayerLevel[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId);
  const share = booking
    ? (BigInt(booking.totalPrice) + BigInt(capacity) - 1n) / BigInt(capacity)
    : 0n;

  function toggleLevel(l: PlayerLevel) {
    setLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function submit() {
    if (restrict && levels.length === 0) {
      toast.error('حداقل یک سطح مجاز انتخاب کنید.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          capacity,
          levelPolicy: restrict ? 'RANGE' : 'ANY',
          allowedLevels: restrict ? levels : [],
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ساخت بازی ناموفق بود.');
        return;
      }

      toast.success('بازی باز شد. حالا بقیه می‌توانند بپیوندند 🎾');
      onClose();
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} title="باز کردن بازی" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-black text-brand-400">کدام رزرو؟</p>
          <div className="space-y-2">
            {bookings.map((b) => {
              const active = b.id === bookingId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBookingId(b.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition',
                    active
                      ? 'border-transparent bg-brand-gradient text-white'
                      : 'border-brand-100 bg-white text-brand-700',
                  )}
                >
                  <span className="num text-sm font-black">{formatTime(new Date(b.startsAt))}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                    {b.courtName}
                    <Dot />
                    {formatJalaliDate(new Date(b.startsAt), { short: true })}
                  </span>
                  <span className={cn('num text-[10px] font-bold', active ? 'text-sky-light/75' : 'text-brand-400')}>
                    {formatToman(BigInt(b.totalPrice))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-black text-brand-400">چند نفره؟</p>
          <div className="grid grid-cols-4 gap-2">
            {[2, 3, 4, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCapacity(n)}
                aria-pressed={capacity === n}
                className={cn(
                  'num rounded-2xl py-3 text-sm font-black transition',
                  capacity === n
                    ? 'bg-brand-gradient text-white'
                    : 'bg-surface-muted text-brand-400',
                )}
              >
                {toFaDigits(n)}
              </button>
            ))}
          </div>
          {booking && (
            <p className="mt-2 rounded-2xl bg-accent-50 px-3 py-2.5 text-[11px] font-bold text-accent-700">
              سهم هر نفر: <span className="num">{formatToman(share)}</span>
            </p>
          )}
        </div>

        <div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={restrict}
              onChange={(e) => setRestrict(e.target.checked)}
              className="h-5 w-5 rounded-md accent-brand-700"
            />
            <span className="text-xs font-extrabold text-brand-700">فقط سطح‌های مشخص بتوانند بپیوندند</span>
          </label>

          {restrict && (
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {LEVEL_ORDER.map((l) => (
                <button
                  key={l}
                  type="button"
                  dir="ltr"
                  onClick={() => toggleLevel(l)}
                  aria-pressed={levels.includes(l)}
                  className={cn(
                    'h-9 rounded-xl text-[11px] font-black transition',
                    levels.includes(l)
                      ? 'bg-brand-gradient text-white'
                      : 'bg-surface-muted text-brand-400',
                  )}
                >
                  {LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-black text-brand-400">توضیح (اختیاری)</p>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            placeholder="مثلاً: بازی دوستانه، سطح متوسط"
            className="h-12 w-full rounded-2xl border border-brand-100 bg-surface-muted px-4 text-sm text-brand-800 outline-none focus:border-brand-500 focus:bg-white"
          />
        </div>

        <button type="button" onClick={submit} disabled={saving || !bookingId} className="btn-accent w-full">
          {saving ? <Spinner /> : 'باز کردن بازی'}
        </button>
      </div>
    </Sheet>
  );
}
