'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search, Building2, UserRound, UserPlus, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { JalaliCalendar } from '@/components/booking/JalaliCalendar';
import { formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { cn, formatToman, rialToToman } from '@/lib/utils';

interface Player {
  id: string;
  username: string;
  phone: string | null;
  name: string;
  balance: string;
}

interface Slot {
  startsAt: string;
  endsAt: string;
  price: string;
  reason: 'BOOKED' | 'PAST' | 'BLACKOUT' | 'LEAD_TIME' | null;
  selectable: boolean;
  owner: { bookingId: string; name: string } | null;
}

interface CourtDay {
  court: { id: string; name: string; slotDurationMinutes: number };
  slots: Slot[];
}

type Mode = 'WALLET' | 'FREE' | 'CLUB' | 'CARD_TO_CARD';
/** رزرو برای چه کسی: بازیکن عضو، مشتری متفرقه (بدون حساب) یا خود باشگاه */
type Who = 'player' | 'guest' | 'club';
/** روش پرداخت برای بازیکن یا مشتری متفرقه */
type Pay = 'WALLET' | 'CARD' | 'FREE';

/** ارقام فارسی را لاتین می‌کند تا در فیلدهای عددی هر دو پذیرفته شوند */
const toLatin = (v: string) => v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

/** کلید روز (YYYY-MM-DD میلادی) به‌اضافه‌ی چند روز */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** ظهرِ آن روز به وقت تهران — برای برچسب تاریخ */
const noonOf = (key: string) => new Date(`${key}T12:00:00+03:30`);

/**
 * پیشخوان رزرو تلفنی.
 * ۱) بازیکن را با نام/موبایل پیدا کن  ۲) روز و سانس را انتخاب کن  ۳) ثبت.
 * کسر از کیف پول و جلوگیری از رزرو تکراری کاملاً سمت سرور انجام می‌شود.
 */
export function DeskBooking({ isAdmin, todayKey }: { isAdmin: boolean; todayKey: string }) {
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [who, setWho] = useState<Who>('player');
  const [pay, setPay] = useState<Pay>('WALLET');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [cardAmountTouched, setCardAmountTouched] = useState(false);
  const [receipt, setReceipt] = useState('');
  const mode: Mode =
    who === 'club' ? 'CLUB' : pay === 'FREE' ? 'FREE' : pay === 'CARD' ? 'CARD_TO_CARD' : 'WALLET';

  const [date, setDate] = useState(todayKey);
  const [stripStart, setStripStart] = useState(todayKey);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [courts, setCourts] = useState<CourtDay[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [courtId, setCourtId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  /* جست‌وجوی بازیکن با کمی تأخیر تا با هر حرف درخواست نرود */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/admin/players?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((json) => setResults(json.ok ? json.data.players : []))
        .catch(() => undefined)
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/admin/availability?date=${date}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'سانس‌ها بارگذاری نشد.');
      setCourts(json.data.courts);
    } catch (error) {
      toast.error((error as Error).message);
      setCourts([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [date, toast]);

  useEffect(() => {
    setSelected([]);
    setCourtId(null);
    void loadSlots();
  }, [loadSlots]);

  const court = courts.find((c) => c.court.id === courtId) ?? null;
  const chosenSlots = useMemo(
    () => (court ? court.slots.filter((s) => selected.includes(s.startsAt)) : []),
    [court, selected],
  );
  const total = chosenSlots.reduce((sum, s) => sum + BigInt(s.price), 0n);
  const charge = mode === 'WALLET' ? total : 0n;
  const balance = player ? BigInt(player.balance) : 0n;
  const insufficient = mode === 'WALLET' && player !== null && charge > balance;

  /* مبلغ کارت به کارت به‌طور پیش‌فرض همان مبلغ رزرو است، تا وقتی پذیرش خودش عوضش نکند */
  useEffect(() => {
    if (!cardAmountTouched) setCardAmount(total > 0n ? rialToToman(total).toString() : '');
  }, [total, cardAmountTouched]);

  function chooseWho(next: Who) {
    setWho(next);
    /* مشتری متفرقه کیف پول ندارد: پیش‌فرضش کارت به کارت است */
    if (next === 'guest' && pay === 'WALLET') setPay('CARD');
    if (next === 'player' && pay === 'CARD' && who === 'guest') setPay('WALLET');
    setConfirming(false);
  }

  const cardAmountNum = Number(cardAmount || '0');
  /* شماره‌ی فیش اختیاری است؛ فقط مبلغ لازم است */
  const cardValid = cardAmountNum > 0;

  function toggleSlot(c: CourtDay, slot: Slot) {
    if (!slot.selectable) return;
    if (courtId !== c.court.id) {
      setCourtId(c.court.id);
      setSelected([slot.startsAt]);
      return;
    }
    setSelected((prev) => {
      if (prev.includes(slot.startsAt)) return prev.filter((s) => s !== slot.startsAt);
      /* فقط سانس‌های پشت‌سرهم؛ انتخابِ جدا از بقیه، انتخاب را از نو شروع می‌کند */
      const idx = c.slots.findIndex((s) => s.startsAt === slot.startsAt);
      const neighbours = [c.slots[idx - 1]?.startsAt, c.slots[idx + 1]?.startsAt];
      return prev.some((p) => neighbours.includes(p)) ? [...prev, slot.startsAt].sort() : [slot.startsAt];
    });
  }

  const customerName = who === 'club' ? 'باشگاه' : who === 'guest' ? guestName.trim() : player?.name ?? '';
  const forWhom =
    who === 'club' ? 'club' : who === 'guest' ? (guestName.trim().length >= 2 ? 'guest' : null) : player ? 'player' : null;
  const ready =
    forWhom !== null &&
    chosenSlots.length > 0 &&
    !insufficient &&
    !(mode === 'WALLET' && who === 'guest') &&
    (mode !== 'CARD_TO_CARD' || cardValid);

  async function submit() {
    if (!court) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: court.court.id,
          slots: chosenSlots.map((s) => s.startsAt),
          mode,
          customer: who === 'guest' ? 'GUEST' : 'PLAYER',
          userId: who === 'player' ? player?.id : undefined,
          guestName: who === 'guest' ? guestName.trim() : undefined,
          guestPhone: who === 'guest' && guestPhone.trim() ? guestPhone.trim() : undefined,
          cardAmountToman: mode === 'CARD_TO_CARD' ? cardAmountNum : undefined,
          receiptNumber: mode === 'CARD_TO_CARD' ? receipt.trim() : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'رزرو ثبت نشد.');

      toast.success(
        mode === 'CLUB'
          ? `رزرو باشگاه ثبت شد (کد ${toFaDigits(json.data.code)}).`
          : mode === 'CARD_TO_CARD'
            ? `رزرو ${customerName} ثبت شد — کارت به کارت ${formatToman(BigInt(cardAmountNum) * 10n)}${receipt.trim() ? `، فیش ${toFaDigits(receipt.trim())}` : ''}.`
            : `رزرو ${customerName} ثبت شد${charge > 0n ? ` و ${formatToman(charge)} از کیف پولش کسر شد` : ''}.`,
      );
      if (who === 'player' && player && charge > 0n) setPlayer({ ...player, balance: (balance - charge).toString() });
      setConfirming(false);
      setSelected([]);
      setNotes('');
      setReceipt('');
      setCardAmountTouched(false);
      if (who === 'guest') {
        setGuestName('');
        setGuestPhone('');
      }
      void loadSlots();
    } catch (error) {
      toast.error((error as Error).message);
      setConfirming(false);
      void loadSlots();
    } finally {
      setSaving(false);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => shiftKey(stripStart, i));

  /* minmax(0,…): ستون از عرض گوشی بیرون نزند — نوار روزها داخل خودش اسکرول می‌خورد */
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {/* ---- ۱. بازیکن ---- */}
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-extrabold text-brand-800">۱. برای چه کسی؟</h2>

          <div className={cn('grid gap-2', isAdmin ? 'grid-cols-3' : 'grid-cols-2')}>
            {(
              [
                ['player', 'بازیکن عضو', UserRound],
                ['guest', 'افراد متفرقه', UserPlus],
                ...(isAdmin ? ([['club', 'به نام باشگاه', Building2]] as const) : []),
              ] as const
            ).map(([value, label, Icon]) => {
              const active = who === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseWho(value)}
                  className={cn(
                    'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-black transition sm:flex-row sm:gap-2 sm:text-[11.5px]',
                    active ? 'bg-primary text-on-primary' : 'bg-surface-muted text-brand-400 hover:text-brand-600',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {who === 'club' ? (
            <p className="rounded-2xl bg-surface-muted p-3 text-[11.5px] font-semibold leading-6 text-brand-500">
              زمین به نام مدیریت رزرو می‌شود: بدون پرداخت و بدون محدودیت زمانی (برای کلاس، تعمیرات یا
              مهمان باشگاه).
            </p>
          ) : who === 'guest' ? (
            <div className="space-y-3">
              <p className="rounded-2xl bg-surface-muted p-3 text-[11px] font-semibold leading-6 text-brand-500">
                برای مشتری‌ای که نمی‌خواهد ثبت‌نام کند. فقط نامش را بنویسید؛ حساب کاربری لازم نیست.
              </p>
              <div>
                <label className="label" htmlFor="desk-guest-name">نام مشتری</label>
                <input
                  id="desk-guest-name"
                  className="field"
                  maxLength={60}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="مثلاً: آقای محمدی"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label" htmlFor="desk-guest-phone">شماره تماس (اختیاری)</label>
                <input
                  id="desk-guest-phone"
                  className="field num text-left"
                  dir="ltr"
                  inputMode="tel"
                  maxLength={20}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value.replace(/[^0-9۰-۹+\-\s]/g, ''))}
                  placeholder="09…"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : player ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-brand-800">{player.name}</p>
                <p className="num truncate text-[10.5px] font-semibold text-brand-400" dir="ltr">
                  @{player.username}
                  {player.phone ? ` · ${player.phone}` : ''}
                </p>
                <p className="num mt-0.5 text-[11px] font-black text-brand-600">
                  موجودی کیف پول: {formatToman(balance)}
                </p>
              </div>
              <button type="button" onClick={() => setPlayer(null)} className="btn-outline btn-sm" aria-label="تغییر بازیکن">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="desk-search">نام، نام خانوادگی یا موبایل بازیکن</label>
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" aria-hidden="true" />
                <input
                  id="desk-search"
                  autoFocus
                  className="field pr-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="مثلاً: رضایی یا ۰۹۱۲…"
                  autoComplete="off"
                />
              </div>
              <ul className="mt-2 space-y-1">
                {searching && results.length === 0 && (
                  <li className="px-3 py-2 text-[11px] font-semibold text-brand-300">در حال جست‌وجو…</li>
                )}
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlayer(p);
                        setQuery('');
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right transition hover:bg-surface-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-extrabold text-brand-800">{p.name}</span>
                        <span className="num block truncate text-[10px] font-semibold text-brand-400" dir="ltr">
                          @{p.username}
                          {p.phone ? ` · ${p.phone}` : ''}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[10.5px] font-black text-brand-600">
                        {formatToman(BigInt(p.balance))}
                      </span>
                    </button>
                  </li>
                ))}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <li className="px-3 py-2 text-[11px] font-semibold text-brand-300">بازیکنی پیدا نشد.</li>
                )}
              </ul>
            </div>
          )}
        </section>

        {/* ---- ۲. روز و سانس ---- */}
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-brand-800">۲. روز و سانس</h2>
            <button type="button" onClick={() => setCalendarOpen(true)} className="btn-outline btn-sm">
              <CalendarDays className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              تقویم
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="هفته‌ی قبل"
              onClick={() => setStripStart(shiftKey(stripStart, -7))}
              disabled={!isAdmin && stripStart <= todayKey}
              className="btn-outline btn-sm px-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {days.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDate(key)}
                  aria-pressed={key === date}
                  className={cn(
                    'min-w-[64px] flex-1 rounded-2xl px-2 py-2 text-center transition',
                    key === date ? 'bg-primary text-on-primary' : 'bg-surface-muted text-brand-500 hover:text-brand-700',
                  )}
                >
                  <span className="block text-[10px] font-bold opacity-80">
                    {key === todayKey ? 'امروز' : formatJalaliDate(noonOf(key), { withWeekday: true, short: true }).split('،')[0]}
                  </span>
                  <span className="num block text-[11.5px] font-black">
                    {formatJalaliDate(noonOf(key), { short: true })}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="هفته‌ی بعد"
              onClick={() => setStripStart(shiftKey(stripStart, 7))}
              className="btn-outline btn-sm px-2"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {loadingSlots ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : courts.length === 0 ? (
            <p className="py-8 text-center text-[11.5px] font-semibold text-brand-300">زمین فعالی نیست.</p>
          ) : (
            <div className="space-y-4">
              {courts.map((c) => (
                <div key={c.court.id}>
                  <p className="mb-2 text-[12px] font-extrabold text-brand-700">{c.court.name}</p>
                  {c.slots.length === 0 ? (
                    <p className="text-[11px] font-semibold text-brand-300">این روز سانسی ندارد.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {c.slots.map((s) => {
                        const isSelected = courtId === c.court.id && selected.includes(s.startsAt);
                        return (
                          <button
                            key={s.startsAt}
                            type="button"
                            disabled={!s.selectable}
                            onClick={() => toggleSlot(c, s)}
                            title={s.owner ? `رزرو ${s.owner.name}` : undefined}
                            className={cn(
                              'rounded-2xl border px-2 py-2 text-center transition',
                              isSelected
                                ? 'border-primary bg-primary text-on-primary'
                                : s.selectable
                                  ? 'border-brand-100 bg-card text-brand-700 hover:border-brand-400'
                                  : 'cursor-not-allowed border-transparent bg-surface-muted text-brand-300',
                            )}
                          >
                            <span className="num block text-[12px] font-black">{formatTime(new Date(s.startsAt))}</span>
                            <span className="block truncate text-[9.5px] font-bold opacity-80">
                              {s.owner
                                ? s.owner.name
                                : s.reason === 'PAST'
                                  ? 'گذشته'
                                  : s.reason === 'BLACKOUT'
                                    ? 'مسدود'
                                    : formatToman(BigInt(s.price), { withUnit: false })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---- ۳. خلاصه و ثبت ---- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-extrabold text-brand-800">۳. ثبت رزرو</h2>

          {chosenSlots.length === 0 || !court ? (
            <p className="text-[11.5px] font-semibold leading-6 text-brand-300">
              مشتری و سانس را انتخاب کنید. برای چند سانس پشت‌سرهم، روی سانس‌های کنار هم بزنید.
            </p>
          ) : (
            <div className="space-y-2 rounded-2xl bg-surface-muted p-3 text-[11.5px]">
              <Row label="زمین" value={court.court.name} />
              <Row label="تاریخ" value={formatJalaliDate(new Date(chosenSlots[0].startsAt), { withWeekday: true })} />
              <Row
                label="ساعت"
                value={`${formatTime(new Date(chosenSlots[0].startsAt))} تا ${formatTime(new Date(chosenSlots.at(-1)!.endsAt))}`}
              />
              <Row label="مبلغ" value={formatToman(total)} />
              {who === 'player' && player && mode === 'WALLET' && (
                <Row
                  label="کیف پول بعد از رزرو"
                  value={formatToman(balance - charge)}
                  danger={insufficient}
                />
              )}
            </div>
          )}

          {who !== 'club' && (
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 text-[11.5px] font-bold text-brand-600">
                <input
                  type="checkbox"
                  checked={pay === 'CARD'}
                  disabled={who === 'guest' && !isAdmin}
                  onChange={(e) => setPay(e.target.checked ? 'CARD' : who === 'guest' ? 'FREE' : 'WALLET')}
                  className="h-4 w-4 accent-primary"
                />
                کارت به کارت — از کیف پول کم نشود
              </label>

              {pay === 'CARD' && (
                <div className="space-y-2.5 rounded-2xl border border-brand-100 p-3">
                  <div>
                    <label className="label" htmlFor="desk-card-amount">مبلغ کارت به کارت (تومان)</label>
                    <input
                      id="desk-card-amount"
                      className="field num text-left"
                      dir="ltr"
                      inputMode="numeric"
                      value={cardAmount}
                      onChange={(e) => {
                        setCardAmountTouched(true);
                        setCardAmount(toLatin(e.target.value).replace(/\D/g, '').slice(0, 11));
                      }}
                      placeholder="مثلاً 450000"
                    />
                    {cardAmountNum > 0 && (
                      <p className="helper num">{formatToman(BigInt(cardAmountNum) * 10n)}</p>
                    )}
                  </div>
                  <div>
                    <label className="label" htmlFor="desk-card-receipt">شماره فیش / کد پیگیری (اختیاری)</label>
                    <input
                      id="desk-card-receipt"
                      className="field num text-left"
                      dir="ltr"
                      maxLength={40}
                      value={receipt}
                      onChange={(e) => setReceipt(e.target.value)}
                      placeholder="مثلاً 123456"
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}

              {isAdmin && (
                <label className="flex items-center gap-2 text-[11.5px] font-bold text-brand-600">
                  <input
                    type="checkbox"
                    checked={pay === 'FREE'}
                    onChange={(e) =>
                      setPay(e.target.checked ? 'FREE' : who === 'guest' ? 'CARD' : 'WALLET')
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  رایگان — هیچ مبلغی دریافت نشود
                </label>
              )}

              {who === 'guest' && pay === 'WALLET' && (
                <p className="text-[11px] font-bold text-danger">مشتری متفرقه کیف پول ندارد.</p>
              )}
            </div>
          )}

          {insufficient && (
            <p className="rounded-2xl bg-danger/10 p-3 text-[11px] font-bold leading-6 text-danger">
              موجودی کیف پول بازیکن کافی نیست. اول کیف پولش را شارژ کنید
              {' یا کارت به کارت را بزنید'}
              {isAdmin ? ' یا گزینه‌ی رایگان را' : ''}.
            </p>
          )}

          <div>
            <label className="label" htmlFor="desk-notes">یادداشت (اختیاری)</label>
            <input
              id="desk-notes"
              className="field"
              maxLength={240}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً: تماس تلفنی، ۴ نفر"
            />
          </div>

          {confirming ? (
            <div className="rounded-2xl bg-accent-50 p-3">
              <p className="text-[11.5px] font-bold leading-6 text-accent-700">
                {mode === 'CLUB'
                  ? 'رزرو به نام باشگاه ثبت شود؟'
                  : mode === 'CARD_TO_CARD'
                    ? `رزرو برای ${customerName}${who === 'guest' ? ' (متفرقه)' : ''} با کارت به کارت ${formatToman(BigInt(cardAmountNum) * 10n)}${receipt.trim() ? ` و فیش ${toFaDigits(receipt.trim())}` : ''} ثبت شود؟ از کیف پول چیزی کم نمی‌شود.`
                    : `رزرو برای ${customerName}${who === 'guest' ? ' (متفرقه)' : ''} ثبت شود${charge > 0n ? ` و ${formatToman(charge)} از کیف پولش کسر شود` : ' (رایگان)'}؟`}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={submit} disabled={saving} className="btn-accent btn-sm flex-1">
                  {saving ? <Spinner /> : 'بله، ثبت کن'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="btn-outline btn-sm flex-1">
                  انصراف
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!ready}
              onClick={() => setConfirming(true)}
              className="btn-primary w-full disabled:opacity-50"
            >
              بررسی و ثبت رزرو
            </button>
          )}
        </section>
      </aside>

      <Sheet open={calendarOpen} onClose={() => setCalendarOpen(false)} title="انتخاب روز">
        <JalaliCalendar
          value={date}
          todayKey={todayKey}
          maxAdvanceDays={365}
          onChange={(key: string) => {
            setDate(key);
            setStripStart(key);
            setCalendarOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold text-brand-400">{label}</span>
      <span className={cn('num font-black', danger ? 'text-danger' : 'text-brand-800')}>{value}</span>
    </div>
  );
}
