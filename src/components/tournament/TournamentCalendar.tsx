'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  JALALI_MONTHS,
  WEEKDAYS_FA_SHORT,
  jalaliMonthLength,
  jsDayToPersianIndex,
  toGregorian,
  toJalali,
} from '@/lib/jalali';
import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  id: string;
  name: string;
  dayKey: string;
  status: string;
  type: string;
}

const STATUS_DOT: Record<string, string> = {
  REGISTRATION_OPEN: 'bg-accent',
  ONGOING: 'bg-success',
  REGISTRATION_CLOSED: 'bg-brand-400',
  COMPLETED: 'bg-brand-200',
  CANCELLED: 'bg-danger/60',
  DRAFT: 'bg-brand-200',
};

/** تقویم شمسی تورنومنت‌ها — روزهای دارای مسابقه با نقطه‌ی رنگی مشخص می‌شوند */
export function TournamentCalendar({
  events,
  todayKey,
}: {
  events: CalendarEvent[];
  todayKey: string;
}) {
  const today = useMemo(() => {
    const [gy, gm, gd] = todayKey.split('-').map(Number);
    return { g: { gy, gm, gd }, j: toJalali(gy, gm, gd) };
  }, [todayKey]);

  const [view, setView] = useState({ jy: today.j.jy, jm: today.j.jm });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!map.has(e.dayKey)) map.set(e.dayKey, []);
      map.get(e.dayKey)!.push(e);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const daysInMonth = jalaliMonthLength(view.jy, view.jm);
    const first = toGregorian(view.jy, view.jm, 1);
    const firstJsDay = new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay();
    const leading = jsDayToPersianIndex(firstJsDay);

    const out: ({ jd: number; key: string } | null)[] = Array(leading).fill(null);
    for (let jd = 1; jd <= daysInMonth; jd += 1) {
      const g = toGregorian(view.jy, view.jm, jd);
      out.push({
        jd,
        key: `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`,
      });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  function shift(delta: number) {
    setView((prev) => {
      let jm = prev.jm + delta;
      let jy = prev.jy;
      if (jm < 1) { jm = 12; jy -= 1; }
      if (jm > 12) { jm = 1; jy += 1; }
      return { jy, jm };
    });
    setSelected(null);
  }

  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];
  const monthEventCount = cells.filter((c) => c && byDay.has(c.key)).length;

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition hover:bg-brand-100"
            aria-label="ماه قبل"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
          <div className="text-center">
            <p className="text-sm font-extrabold text-brand-800">
              {JALALI_MONTHS[view.jm - 1]} {toFaDigits(view.jy)}
            </p>
            <p className="num mt-0.5 text-[10px] font-bold text-brand-300">
              {monthEventCount > 0 ? `${toFaDigits(monthEventCount)} روز مسابقه` : 'بدون مسابقه'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => shift(1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition hover:bg-brand-100"
            aria-label="ماه بعد"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS_FA_SHORT.map((d, i) => (
            <div
              key={d}
              className={cn(
                'py-1 text-center text-[10px] font-black',
                i === 6 ? 'text-danger/60' : 'text-brand-300',
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} />;
            const dayEvents = byDay.get(cell.key) ?? [];
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selected;

            return (
              <button
                key={cell.key}
                type="button"
                disabled={dayEvents.length === 0}
                onClick={() => setSelected(isSelected ? null : cell.key)}
                className={cn(
                  'num relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold transition-all duration-200',
                  isSelected
                    ? 'bg-brand-gradient text-white shadow-card'
                    : dayEvents.length > 0
                      ? 'cursor-pointer bg-brand-50 text-brand-800 hover:bg-brand-100'
                      : 'text-brand-200',
                  isToday && !isSelected && 'ring-1 ring-accent/50',
                )}
              >
                {toFaDigits(cell.jd)}
                {dayEvents.length > 0 && (
                  <span className="flex gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isSelected ? 'bg-accent' : (STATUS_DOT[e.status] ?? 'bg-brand-300'),
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedEvents.length > 0 && (
        <div className="animate-fade-up space-y-2">
          {selectedEvents.map((e) => (
            <Link key={e.id} href={`/tournaments/${e.id}`} className="card-interactive block p-3.5">
              <div className="flex items-center gap-3">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_DOT[e.status])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-brand-800">{e.name}</p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-brand-400">{e.type}</p>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-brand-200" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
