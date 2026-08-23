'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { JalaliCalendar } from './JalaliCalendar';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

interface SlotDto {
  startsAt: string;
  endsAt: string;
  price: string;
  ruleName: string | null;
  available: boolean;
  reason: 'BOOKED' | 'PAST' | 'BLACKOUT' | 'LEAD_TIME' | null;
  isMine: boolean;
}

interface CourtDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotDurationMinutes: number;
  maxConsecutiveSlots: number;
  basePrice: string;
}

interface AvailabilityDto {
  court: CourtDto;
  slots: SlotDto[];
}

const REASON_LABEL: Record<string, string> = {
  BOOKED: 'رزرو شده',
  PAST: 'گذشته',
  BLACKOUT: 'مسدود',
  LEAD_TIME: 'دیر است',
};

export function BookingFlow({
  courts,
  todayKey,
  balance,
  maxAdvanceDays,
}: {
  courts: CourtDto[];
  todayKey: string;
  balance: string;
  maxAdvanceDays: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [date, setDate] = useState(todayKey);
  const [courtId, setCourtId] = useState(courts[0]?.id ?? '');
  const [data, setData] = useState<AvailabilityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!courtId) return;
    setLoading(true);
    setSelected([]);
    try {
      const res = await fetch(`/api/bookings/availability?date=${date}&courtId=${courtId}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.ok) setData(json.data.courts[0] ?? null);
      else toast.error(json.error || 'دریافت ساعات ممکن نشد.');
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }, [date, courtId, toast]);

  useEffect(() => { void load(); }, [load]);

  const court = data?.court;
  const slots = data?.slots ?? [];

  /** انتخاب فقط به‌صورت بازه‌ی پیوسته مجاز است */
  const toggleSlot = (slot: SlotDto) => {
    if (!slot.available) return;
    const index = slots.findIndex((s) => s.startsAt === slot.startsAt);
    const selectedIdx = selected
      .map((s) => slots.findIndex((x) => x.startsAt === s))
      .sort((a, b) => a - b);

    if (selected.includes(slot.startsAt)) {
      // فقط دو سر بازه قابل حذف است تا بازه پیوسته بماند
      if (index === selectedIdx[0] || index === selectedIdx[selectedIdx.length - 1]) {
        setSelected((prev) => prev.filter((s) => s !== slot.startsAt));
      } else {
        setSelected([slot.startsAt]);
      }
      return;
    }

    if (selectedIdx.length === 0) {
      setSelected([slot.startsAt]);
      return;
    }

    const min = selectedIdx[0];
    const max = selectedIdx[selectedIdx.length - 1];
    const isAdjacent = index === min - 1 || index === max + 1;
    const maxCount = court?.maxConsecutiveSlots ?? 4;

    if (!isAdjacent || selected.length >= maxCount) {
      if (selected.length >= maxCount && isAdjacent) {
        toast.error(`حداکثر ${toFaDigits(maxCount)} سانس پشت‌سرهم قابل انتخاب است.`);
        return;
      }
      setSelected([slot.startsAt]);
      return;
    }

    setSelected((prev) => [...prev, slot.startsAt]);
  };

  const selectedSlots = useMemo(
    () =>
      slots
        .filter((s) => selected.includes(s.startsAt))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [slots, selected],
  );

  const total = useMemo(
    () => selectedSlots.reduce((sum, s) => sum + BigInt(s.price), 0n),
    [selectedSlots],
  );

  const insufficient = total > BigInt(balance);

  async function confirm() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courtId, slots: selectedSlots.map((s) => s.startsAt) }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ثبت رزرو ناموفق بود.');
        if (json.code === 'SLOT_TAKEN') { setConfirmOpen(false); await load(); }
        return;
      }

      toast.success('رزرو شما با موفقیت ثبت شد 🎾');
      setConfirmOpen(false);
      router.push(`/bookings/${json.data.id}`);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* انتخاب زمین */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {courts.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCourtId(c.id)}
            className={cn(
              'shrink-0 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition-all duration-200',
              courtId === c.id
                ? 'bg-brand-gradient text-white shadow-card'
                : 'bg-white text-brand-500 shadow-card ring-1 ring-brand-900/[.04] hover:text-brand-700',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <JalaliCalendar
        value={date}
        onChange={setDate}
        todayKey={todayKey}
        maxAdvanceDays={maxAdvanceDays}
      />

      {/* ساعات */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-brand-800">ساعات موجود</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-brand-400">
              {formatJalaliDate(new Date(`${date}T12:00:00Z`), { withWeekday: true })}
            </p>
          </div>
          {court && (
            <span className="badge-brand">
              هر سانس {toFaDigits(court.slotDurationMinutes)} دقیقه
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold text-brand-300">
            برای این روز سانسی تعریف نشده است.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const isSelected = selected.includes(slot.startsAt);
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => toggleSlot(slot)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 transition-all duration-200',
                    isSelected
                      ? 'border-transparent bg-brand-gradient text-white shadow-card'
                      : slot.available
                        ? 'border-brand-100 bg-surface-muted text-brand-700 hover:border-brand-200 hover:bg-white'
                        : 'cursor-not-allowed border-transparent bg-brand-50/60 text-brand-200',
                  )}
                >
                  <span className="num text-xs font-black">
                    {formatTime(new Date(slot.startsAt))}
                  </span>
                  {slot.available ? (
                    <span
                      className={cn(
                        'num text-[9px] font-bold',
                        isSelected ? 'text-sky-light/80' : 'text-brand-400',
                      )}
                    >
                      {formatToman(BigInt(slot.price), { withUnit: false })}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold">
                      {slot.isMine ? 'رزرو شما' : REASON_LABEL[slot.reason ?? ''] ?? '—'}
                    </span>
                  )}
                  {slot.isMine && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold text-brand-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-surface-muted ring-1 ring-brand-100" /> آزاد
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-brand-700" /> انتخاب شما
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-brand-50" /> رزرو شده
          </span>
        </div>
      </div>

      {/* نوار جمع‌بندی */}
      {selectedSlots.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(var(--nav-height)+var(--safe-bottom))] z-40 animate-slide-up px-4">
          <div className="app-shell">
            <div className="card flex items-center gap-3 p-3 shadow-premium">
              <div className="min-w-0 flex-1">
                <p className="num text-xs font-extrabold text-brand-800">
                  {formatTime(new Date(selectedSlots[0].startsAt))} تا{' '}
                  {formatTime(new Date(selectedSlots[selectedSlots.length - 1].endsAt))}
                </p>
                <p className="num mt-0.5 text-[11px] font-bold text-brand-400">
                  {toFaDigits(selectedSlots.length)} سانس <Dot />{formatToman(total)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="btn-accent btn-sm shrink-0"
              >
                ادامه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تأیید نهایی */}
      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="تأیید رزرو">
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-muted p-4">
            <Row label="زمین" value={court?.name ?? '—'} />
            <Row
              label="تاریخ"
              value={formatJalaliDate(new Date(`${date}T12:00:00Z`), { withWeekday: true })}
            />
            <Row
              label="ساعت"
              value={
                selectedSlots.length
                  ? `${formatTime(new Date(selectedSlots[0].startsAt))} تا ${formatTime(
                      new Date(selectedSlots[selectedSlots.length - 1].endsAt),
                    )}`
                  : '—'
              }
            />
            <Row label="تعداد سانس" value={toFaDigits(selectedSlots.length)} />
          </div>

          <div className="space-y-2">
            {selectedSlots.map((s) => (
              <div key={s.startsAt} className="flex items-center justify-between text-xs">
                <span className="num font-semibold text-brand-500">
                  {formatTime(new Date(s.startsAt))} — {formatTime(new Date(s.endsAt))}
                  {s.ruleName && (
                    <span className="mr-2 text-[10px] font-bold text-accent-600">{s.ruleName}</span>
                  )}
                </span>
                <span className="num font-bold text-brand-700">{formatToman(BigInt(s.price))}</span>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-brand-800">مبلغ نهایی</span>
            <span className="num text-lg font-black text-brand-800">{formatToman(total)}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-brand-400">موجودی کیف پول</span>
            <span className={cn('num', insufficient ? 'text-danger' : 'text-success')}>
              {formatToman(BigInt(balance))}
            </span>
          </div>

          {insufficient ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-danger/[.06] px-4 py-3 text-xs font-bold leading-6 text-danger">
                موجودی کیف پول شما کافی نیست. لطفاً ابتدا کیف پول خود را شارژ کنید.
              </div>
              <a href="/wallet" className="btn-accent btn-lg w-full">
                شارژ کیف پول
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={submitting}
              className="btn-accent btn-lg w-full"
            >
              {submitting ? <Spinner /> : 'پرداخت و تأیید رزرو'}
            </button>
          )}

          <p className="text-center text-[10px] leading-5 text-brand-300">
            با تأیید رزرو، مبلغ از کیف پول شما کسر می‌شود. در صورت لغو، بازگشت وجه طبق قوانین باشگاه انجام می‌گیرد.
          </p>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] font-bold text-brand-400">{label}</span>
      <span className="text-xs font-extrabold text-brand-800">{value}</span>
    </div>
  );
}
