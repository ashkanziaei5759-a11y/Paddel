'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CircleAlert, Clock, LandPlot } from 'lucide-react';
import { JalaliCalendar } from './JalaliCalendar';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Dot } from '@/components/ui/Dot';
import { formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { cn, formatToman } from '@/lib/utils';

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

interface CourtAvailability {
  court: CourtDto;
  slots: SlotDto[];
}

/** یک ساعت شروع، به‌همراه وضعیت آن در هر زمین */
interface TimeRow {
  startsAt: string;
  endsAt: string;
  perCourt: Map<string, SlotDto>;
  freeCourts: number;
  totalCourts: number;
}

type Step = 'date' | 'time' | 'court';

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

  const [step, setStep] = useState<Step>('date');
  const [date, setDate] = useState(todayKey);
  const [data, setData] = useState<CourtAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelectedTimes([]);
    setCourtId(null);
    try {
      const res = await fetch(`/api/bookings/availability?date=${date}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setData(json.data.courts);
      else toast.error(json.error || 'دریافت ساعات ممکن نشد.');
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** ساعات یکتا در همه‌ی زمین‌ها، با وضعیت هر زمین در آن ساعت */
  const timeRows = useMemo<TimeRow[]>(() => {
    const map = new Map<string, TimeRow>();
    for (const entry of data) {
      for (const slot of entry.slots) {
        let row = map.get(slot.startsAt);
        if (!row) {
          row = {
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            perCourt: new Map(),
            freeCourts: 0,
            totalCourts: 0,
          };
          map.set(slot.startsAt, row);
        }
        row.perCourt.set(entry.court.id, slot);
        row.totalCourts += 1;
        if (slot.available) row.freeCourts += 1;
      }
    }
    return [...map.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [data]);

  const slotDuration = courts[0]?.slotDurationMinutes ?? 90;
  const maxConsecutive = courts[0]?.maxConsecutiveSlots ?? 4;

  /** انتخاب ساعت — فقط بازه‌ی پیوسته مجاز است */
  function toggleTime(row: TimeRow) {
    if (row.freeCourts === 0) return;
    const index = timeRows.findIndex((r) => r.startsAt === row.startsAt);
    const chosen = selectedTimes
      .map((t) => timeRows.findIndex((r) => r.startsAt === t))
      .sort((a, b) => a - b);

    if (selectedTimes.includes(row.startsAt)) {
      if (index === chosen[0] || index === chosen[chosen.length - 1]) {
        setSelectedTimes((prev) => prev.filter((t) => t !== row.startsAt));
      } else {
        setSelectedTimes([row.startsAt]);
      }
      setCourtId(null);
      return;
    }

    if (chosen.length === 0) {
      setSelectedTimes([row.startsAt]);
      setCourtId(null);
      return;
    }

    const adjacent = index === chosen[0] - 1 || index === chosen[chosen.length - 1] + 1;
    if (!adjacent) {
      setSelectedTimes([row.startsAt]);
    } else if (selectedTimes.length >= maxConsecutive) {
      toast.error(`حداکثر ${toFaDigits(maxConsecutive)} سانس پشت‌سرهم قابل انتخاب است.`);
      return;
    } else {
      setSelectedTimes((prev) => [...prev, row.startsAt]);
    }
    setCourtId(null);
  }

  const orderedTimes = useMemo(
    () => [...selectedTimes].sort((a, b) => a.localeCompare(b)),
    [selectedTimes],
  );

  /** زمین‌هایی که در تمام ساعات انتخاب‌شده آزادند */
  const courtOptions = useMemo(() => {
    if (orderedTimes.length === 0) return [];
    return data.map((entry) => {
      const slots = orderedTimes.map((t) => entry.slots.find((s) => s.startsAt === t));
      const allFree = slots.every((s) => s?.available);
      const total = slots.reduce((sum, s) => sum + (s ? BigInt(s.price) : 0n), 0n);
      const blocked = slots.find((s) => s && !s.available);
      return {
        court: entry.court,
        available: allFree,
        total,
        mine: slots.some((s) => s?.isMine),
        reason: blocked?.reason ?? null,
      };
    });
  }, [data, orderedTimes]);

  const chosenCourt = courtOptions.find((c) => c.court.id === courtId);
  const total = chosenCourt?.total ?? 0n;
  const insufficient = total > BigInt(balance);

  async function confirm() {
    if (!courtId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courtId, slots: orderedTimes }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ثبت رزرو ناموفق بود.');
        if (json.code === 'SLOT_TAKEN') {
          setConfirmOpen(false);
          await load();
          setStep('time');
        }
        return;
      }

      toast.success('رزرو شما با موفقیت ثبت شد');
      setConfirmOpen(false);
      router.push(`/bookings/${json.data.id}`);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = step === 'date' ? 0 : step === 'time' ? 1 : 2;

  return (
    <div className="space-y-4">
      {/* ---- نوار مراحل ---- */}
      <ol className="flex items-center gap-2" aria-label="مراحل رزرو">
        {[
          { key: 'date' as Step, label: 'تاریخ', done: true },
          { key: 'time' as Step, label: 'ساعت', done: orderedTimes.length > 0 },
          { key: 'court' as Step, label: 'زمین', done: Boolean(courtId) },
        ].map((s, i) => {
          const active = stepIndex === i;
          const reachable = i === 0 || (i === 1 && true) || (i === 2 && orderedTimes.length > 0);
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(s.key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-right transition-colors',
                  active ? 'bg-brand-gradient text-white shadow-card' : 'bg-white text-brand-400',
                  !reachable && 'opacity-45',
                )}
              >
                <span
                  className={cn(
                    'num flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black',
                    active ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-500',
                  )}
                >
                  {i < stepIndex && s.done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    toFaDigits(i + 1)
                  )}
                </span>
                <span className="text-[11px] font-extrabold">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ---- گام ۱: تاریخ ---- */}
      {step === 'date' && (
        <div className="animate-fade-up space-y-4">
          <JalaliCalendar
            value={date}
            onChange={(d) => {
              setDate(d);
              setStep('time');
            }}
            todayKey={todayKey}
            maxAdvanceDays={maxAdvanceDays}
          />
          <p className="text-center text-[11px] font-bold text-brand-300">
            برای دیدن ساعت‌های آزاد، یک روز را انتخاب کنید.
          </p>
        </div>
      )}

      {/* ---- گام ۲: ساعت ---- */}
      {step === 'time' && (
        <div className="animate-fade-up space-y-4">
          <div className="card p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-brand-800">انتخاب ساعت</h2>
                <p className="mt-1 text-[11px] font-semibold text-brand-400">
                  {formatJalaliDate(new Date(`${date}T12:00:00Z`), { withWeekday: true })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('date')}
                className="btn-ghost btn-sm shrink-0"
              >
                تغییر تاریخ
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="skeleton h-[68px]" />
                ))}
              </div>
            ) : timeRows.length === 0 ? (
              <p className="py-10 text-center text-xs font-bold text-brand-300">
                برای این روز سانسی تعریف نشده است.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {timeRows.map((row) => {
                  const selected = selectedTimes.includes(row.startsAt);
                  const full = row.freeCourts === 0;
                  const mine = [...row.perCourt.values()].some((s) => s.isMine);

                  return (
                    <button
                      key={row.startsAt}
                      type="button"
                      disabled={full}
                      onClick={() => toggleTime(row)}
                      aria-pressed={selected}
                      className={cn(
                        'relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 transition-all duration-200',
                        selected
                          ? 'border-transparent bg-brand-gradient text-white shadow-card'
                          : mine
                            ? 'border-transparent bg-brand-100 text-brand-700'
                            : full
                              ? 'cursor-not-allowed border-transparent bg-danger/10 text-danger/70'
                              : 'border-brand-100 bg-white text-brand-700 hover:border-brand-200',
                      )}
                    >
                      <span className="num text-xs font-black">
                        {formatTime(new Date(row.startsAt))}
                      </span>
                      <span
                        className={cn(
                          'num text-[9px] font-bold',
                          selected
                            ? 'text-sky-light/80'
                            : full
                              ? 'text-danger/70'
                              : 'text-brand-400',
                        )}
                      >
                        {mine && !selected
                          ? 'رزرو شما'
                          : full
                            ? 'تکمیل'
                            : `${toFaDigits(row.freeCourts)} زمین آزاد`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold text-brand-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-white ring-1 ring-brand-100" /> آزاد
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-brand-700" /> انتخاب شما
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-brand-100" /> رزرو شما
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-danger/25" /> تکمیل
              </span>
            </div>
          </div>

          {orderedTimes.length > 0 && (
            <button type="button" onClick={() => setStep('court')} className="btn-accent btn-lg w-full">
              انتخاب زمین
              <span className="num text-[11px] opacity-80">
                ({toFaDigits(orderedTimes.length)} سانس)
              </span>
            </button>
          )}
        </div>
      )}

      {/* ---- گام ۳: زمین ---- */}
      {step === 'court' && (
        <div className="animate-fade-up space-y-4">
          <div className="card p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-brand-800">انتخاب زمین</h2>
                <p className="num mt-1 text-[11px] font-semibold text-brand-400">
                  {formatJalaliDate(new Date(`${date}T12:00:00Z`), { short: true })}
                  <Dot />
                  {formatTime(new Date(orderedTimes[0]))} تا{' '}
                  {formatTime(
                    new Date(
                      new Date(orderedTimes[orderedTimes.length - 1]).getTime() +
                        slotDuration * 60_000,
                    ),
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('time')}
                className="btn-ghost btn-sm shrink-0"
              >
                تغییر ساعت
              </button>
            </div>

            <div className="space-y-2.5">
              {courtOptions.map((opt) => {
                const active = courtId === opt.court.id;
                return (
                  <button
                    key={opt.court.id}
                    type="button"
                    disabled={!opt.available}
                    onClick={() => setCourtId(opt.court.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-right transition-all duration-200',
                      active
                        ? 'border-transparent bg-brand-gradient text-white shadow-card'
                        : opt.available
                          ? 'border-brand-100 bg-white hover:border-brand-200'
                          : 'cursor-not-allowed border-transparent bg-danger/[.07]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                        active
                          ? 'bg-white/15 text-white'
                          : opt.available
                            ? 'bg-brand-50 text-brand-600'
                            : 'bg-danger/10 text-danger/70',
                      )}
                    >
                      {opt.available ? (
                        <LandPlot className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <CircleAlert className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-xs font-extrabold',
                          active ? 'text-white' : opt.available ? 'text-brand-800' : 'text-danger',
                        )}
                      >
                        {opt.court.name}
                      </span>
                      <span
                        className={cn(
                          'mt-1 block truncate text-[10px] font-semibold',
                          active
                            ? 'text-sky-light/75'
                            : opt.available
                              ? 'text-brand-400'
                              : 'text-danger/70',
                        )}
                      >
                        {opt.available
                          ? (opt.court.description ?? 'آماده‌ی رزرو')
                          : opt.mine
                            ? 'در این ساعت رزرو شماست'
                            : 'در این ساعت رزرو شده است'}
                      </span>
                    </span>

                    {opt.available && (
                      <span
                        className={cn(
                          'num shrink-0 text-xs font-black',
                          active ? 'text-accent' : 'text-brand-700',
                        )}
                      >
                        {formatToman(opt.total)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {courtId && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="btn-accent btn-lg w-full"
            >
              ادامه و پرداخت
              <span className="num text-[11px] opacity-80">{formatToman(total)}</span>
            </button>
          )}
        </div>
      )}

      {/* ---- تأیید نهایی ---- */}
      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="تأیید رزرو">
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-muted p-4">
            <Row label="زمین" value={chosenCourt?.court.name ?? '—'} />
            <Row
              label="تاریخ"
              value={formatJalaliDate(new Date(`${date}T12:00:00Z`), { withWeekday: true })}
            />
            <Row
              label="ساعت"
              value={
                orderedTimes.length
                  ? `${formatTime(new Date(orderedTimes[0]))} تا ${formatTime(
                      new Date(
                        new Date(orderedTimes[orderedTimes.length - 1]).getTime() +
                          slotDuration * 60_000,
                      ),
                    )}`
                  : '—'
              }
            />
            <Row label="تعداد سانس" value={toFaDigits(orderedTimes.length)} />
          </div>

          <div className="space-y-2">
            {orderedTimes.map((t) => {
              const slot = data
                .find((d) => d.court.id === courtId)
                ?.slots.find((s) => s.startsAt === t);
              if (!slot) return null;
              return (
                <div key={t} className="flex items-center justify-between text-xs">
                  <span className="num flex items-center gap-1.5 font-semibold text-brand-500">
                    <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    {formatTime(new Date(slot.startsAt))} — {formatTime(new Date(slot.endsAt))}
                    {slot.ruleName && (
                      <span className="mr-1 text-[10px] font-bold text-accent-600">
                        {slot.ruleName}
                      </span>
                    )}
                  </span>
                  <span className="num font-bold text-brand-700">
                    {formatToman(BigInt(slot.price))}
                  </span>
                </div>
              );
            })}
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
                موجودی کیف پول شما کافی نیست. ابتدا کیف پول خود را شارژ کنید.
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
            با تأیید رزرو، مبلغ از کیف پول شما کسر می‌شود. در صورت لغو، بازگشت وجه طبق قوانین باشگاه
            انجام می‌گیرد.
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
