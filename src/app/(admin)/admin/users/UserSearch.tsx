'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LEVEL_LABEL, LEVEL_ORDER } from '@/lib/constants';

export function UserSearch({
  defaultQuery,
  defaultLevel,
  defaultRole,
}: {
  defaultQuery: string;
  defaultLevel: string;
  defaultRole: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const [level, setLevel] = useState(defaultLevel);
  const [role, setRole] = useState(defaultRole);

  function apply(event?: React.FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (level) params.set('level', level);
    if (role) params.set('role', role);
    router.push(`/admin/users${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <form onSubmit={apply} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[200px] flex-1">
        <label className="label" htmlFor="q">جستجو</label>
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field"
          placeholder="نام، نام کاربری یا شماره موبایل"
        />
      </div>

      <div className="w-32">
        <label className="label" htmlFor="level">سطح</label>
        <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} className="field">
          <option value="">همه</option>
          {LEVEL_ORDER.map((l) => (
            <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
          ))}
        </select>
      </div>

      <div className="w-32">
        <label className="label" htmlFor="role">نقش</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className="field">
          <option value="">همه</option>
          <option value="PLAYER">بازیکن</option>
          <option value="ADMIN">مدیر</option>
        </select>
      </div>

      <button type="submit" className="btn-primary">اعمال فیلتر</button>
    </form>
  );
}
