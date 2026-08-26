'use client';

import { useMemo, useState } from 'react';
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

interface Props {
  /** تاریخ انتخاب‌شده به قالب YYYY-MM-DD میلادی */
  value: string;
  onChange: (dayKey: string) => void;
  /** تعداد روزهای قابل انتخاب از امروز به بعد */
  maxAdvanceDays?: number;
  todayKey: string;
}

function keyOf(gy: number, gm: number, gd: number) {
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

export function JalaliCalendar({ value, onChange, maxAdvanceDays = 30, todayKey }: Props) {
  const selected = useMemo(() => {
    const [gy, gm, gd] = value.split('-').map(Number);
    return toJalali(gy, gm, gd);
  }, [value]);

  const today = useMemo(() => {
    const [gy, gm, gd] = todayKey.split('-').map(Number);
    return { g: { gy, gm, gd }, j: toJalali(gy, gm, gd) };
  }, [todayKey]);

  const [view, setView] = useState({ jy: selected.jy, jm: selected.jm });

  const grid = useMemo(() => {
    const daysInMonth = jalaliMonthLength(view.jy, view.jm);
    const first = toGregorian(view.jy, view.jm, 1);
    const firstJsDay = new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay();
    const leading = jsDayToPersianIndex(firstJsDay);

    const cells: ({ jd: number; key: string } | null)[] = Array(leading).fill(null);
    for (let jd = 1; jd <= daysInMonth; jd += 1) {
      const g = toGregorian(view.jy, view.jm, jd);
      cells.push({ jd, key: keyOf(g.gy, g.gm, g.gd) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const minKey = todayKey;
  const maxKey = useMemo(() => {
    const d = new Date(Date.UTC(today.g.gy, today.g.gm - 1, today.g.gd));
    d.setUTCDate(d.getUTCDate() + maxAdvanceDays);
    return keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }, [today, maxAdvanceDays]);

  function shiftMonth(delta: number) {
    setView((prev) => {
      let jm = prev.jm + delta;
      let jy = prev.jy;
      if (jm < 1) { jm = 12; jy -= 1; }
      if (jm > 12) { jm = 1; jy += 1; }
      return { jy, jm };
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition hover:bg-brand-100"
          aria-label="ماه قبل"
        >
          ›
        </button>
        <div className="text-center">
          <p className="text-sm font-extrabold text-brand-800">
            {JALALI_MONTHS[view.jm - 1]} {toFaDigits(view.jy)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition hover:bg-brand-100"
          aria-label="ماه بعد"
        >
          ‹
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
        {grid.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} />;

          const disabled = cell.key < minKey || cell.key > maxKey;
          const isSelected = cell.key === value;
          const isToday = cell.key === todayKey;
          const isFriday = index % 7 === 6;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(cell.key)}
              className={cn(
                'num relative aspect-square rounded-xl text-xs font-bold transition-all duration-200',
                isSelected
                  ? 'bg-brand-gradient text-white shadow-card'
                  : disabled
                    ? 'cursor-not-allowed text-brand-300'
                    : isFriday
                      ? 'text-danger/70 hover:bg-brand-50'
                      : 'text-brand-700 hover:bg-brand-50',
              )}
            >
              {toFaDigits(cell.jd)}
              {isToday && !isSelected && (
                <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
