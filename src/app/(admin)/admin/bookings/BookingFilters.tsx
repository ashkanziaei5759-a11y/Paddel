'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { BOOKING_STATUS_LABEL } from '@/lib/constants';

export function BookingFilters({
  courts,
  defaultDate,
  defaultCourtId,
  defaultStatus,
  defaultScope,
  todayKey,
}: {
  courts: { id: string; name: string }[];
  defaultDate: string;
  defaultCourtId: string;
  defaultStatus: string;
  defaultScope: string;
  todayKey: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [courtId, setCourtId] = useState(defaultCourtId);
  const [status, setStatus] = useState(defaultStatus);
  const [scope, setScope] = useState(defaultScope);

  function apply(next?: Partial<{ date: string; courtId: string; status: string; scope: string }>) {
    const state = { date, courtId, status, scope, ...next };
    const params = new URLSearchParams();
    if (state.date) params.set('date', state.date);
    if (state.courtId) params.set('courtId', state.courtId);
    if (state.status) params.set('status', state.status);
    if (state.scope) params.set('scope', state.scope);
    router.push(`/admin/bookings${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <div className="card space-y-3 p-4">
      <Segmented
        value={scope}
        onChange={(v) => { setScope(v); apply({ scope: v, date: '' }); setDate(''); }}
        options={[
          { value: 'upcoming', label: 'پیش‌رو' },
          { value: 'past', label: 'گذشته' },
          { value: 'all', label: 'همه' },
        ]}
      />

      <form
        onSubmit={(e) => { e.preventDefault(); apply(); }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-40">
          <label className="label" htmlFor="date">تاریخ مشخص</label>
          <input
            id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            dir="ltr" className="field text-left" max="2100-01-01"
          />
        </div>

        <div className="min-w-[140px] flex-1">
          <label className="label" htmlFor="court">زمین</label>
          <select id="court" value={courtId} onChange={(e) => setCourtId(e.target.value)} className="field">
            <option value="">همه زمین‌ها</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="w-36">
          <label className="label" htmlFor="status">وضعیت</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field">
            <option value="">همه</option>
            {Object.entries(BOOKING_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary">اعمال</button>
        <button
          type="button"
          onClick={() => { setDate(todayKey); apply({ date: todayKey, scope: 'all' }); setScope('all'); }}
          className="btn-outline"
        >
          امروز
        </button>
      </form>
    </div>
  );
}
