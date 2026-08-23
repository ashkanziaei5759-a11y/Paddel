'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { MATCH_STAGE_LABEL } from '@/lib/constants';
import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

interface MatchDto {
  id: string;
  stage: keyof typeof MATCH_STAGE_LABEL;
  round: number;
  slotInRound: number;
  status: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string | null;
  teamBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
}

interface SetScore {
  a: string;
  b: string;
}

export function MatchResults({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: MatchDto[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [active, setActive] = useState<MatchDto | null>(null);
  const [sets, setSets] = useState<SetScore[]>([{ a: '', b: '' }]);
  const [loading, setLoading] = useState(false);

  function open(match: MatchDto) {
    setActive(match);
    setSets([
      { a: '', b: '' },
      { a: '', b: '' },
    ]);
  }

  async function submit() {
    if (!active) return;

    const parsed = sets
      .filter((s) => s.a !== '' && s.b !== '')
      .map((s) => ({ a: Number(s.a), b: Number(s.b) }));

    if (parsed.length === 0) {
      toast.error('حداقل نتیجه‌ی یک ست را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/matches/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets: parsed, status: 'COMPLETED' }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) { toast.error(json.error || 'ثبت نتیجه ناموفق بود.'); return; }

      toast.success('نتیجه ثبت و جدول به‌روزرسانی شد.');
      setActive(null);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  const grouped = matches.reduce<Record<string, MatchDto[]>>((acc, match) => {
    const key = `${match.stage}-${match.round}`;
    (acc[key] ||= []).push(match);
    return acc;
  }, {});

  return (
    <>
      <section>
        <h2 className="mb-3 text-sm font-extrabold text-brand-800">ثبت نتایج مسابقات</h2>
        <div className="space-y-3">
          {Object.entries(grouped).map(([key, list]) => (
            <div key={key} className="card overflow-hidden">
              <div className="border-b border-brand-50 bg-surface-muted px-4 py-2.5">
                <p className="text-[11px] font-black text-brand-500">
                  {MATCH_STAGE_LABEL[list[0].stage]} <Dot />دور {toFaDigits(list[0].round)}
                </p>
              </div>
              <div className="divide-y divide-brand-50">
                {list.map((match) => {
                  const ready = Boolean(match.teamAId && match.teamBId);
                  const done = match.status === 'COMPLETED' || match.status === 'WALKOVER';
                  return (
                    <div key={match.id} className="flex items-center gap-2 p-3">
                      <span className="flex-1 truncate text-right text-[11px] font-bold text-brand-700">
                        {match.teamAName ?? '—'}
                      </span>
                      <span
                        className={cn(
                          'num shrink-0 rounded-lg px-2.5 py-1 text-xs font-black',
                          done ? 'bg-accent-50 text-accent-700' : 'bg-surface-muted text-brand-300',
                        )}
                      >
                        {done ? `${toFaDigits(match.scoreA ?? 0)} − ${toFaDigits(match.scoreB ?? 0)}` : 'vs'}
                      </span>
                      <span className="flex-1 truncate text-left text-[11px] font-bold text-brand-700">
                        {match.teamBName ?? '—'}
                      </span>
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => open(match)}
                        className="btn-sm btn-outline shrink-0"
                      >
                        {done ? 'ویرایش' : 'ثبت'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Sheet open={active !== null} onClose={() => setActive(null)} title="ثبت نتیجه مسابقه">
        {active && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl bg-surface-muted p-3">
              <span className="flex-1 truncate text-right text-xs font-extrabold text-brand-800">
                {active.teamAName}
              </span>
              <span className="text-[11px] font-black text-brand-300">مقابل</span>
              <span className="flex-1 truncate text-left text-xs font-extrabold text-brand-800">
                {active.teamBName}
              </span>
            </div>

            <div className="space-y-2">
              {sets.map((set, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-14 text-[11px] font-bold text-brand-400">
                    ست {toFaDigits(index + 1)}
                  </span>
                  <input
                    value={set.a}
                    onChange={(e) => {
                      const next = [...sets];
                      next[index] = { ...set, a: e.target.value.replace(/\D/g, '').slice(0, 2) };
                      setSets(next);
                    }}
                    inputMode="numeric" dir="ltr"
                    className="field num flex-1 text-center" placeholder="6"
                  />
                  <span className="text-xs font-black text-brand-300">−</span>
                  <input
                    value={set.b}
                    onChange={(e) => {
                      const next = [...sets];
                      next[index] = { ...set, b: e.target.value.replace(/\D/g, '').slice(0, 2) };
                      setSets(next);
                    }}
                    inputMode="numeric" dir="ltr"
                    className="field num flex-1 text-center" placeholder="4"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSets((prev) => [...prev, { a: '', b: '' }])}
                disabled={sets.length >= 7}
                className="btn-outline btn-sm flex-1"
              >
                + ست
              </button>
              <button
                type="button"
                onClick={() => setSets((prev) => prev.slice(0, -1))}
                disabled={sets.length <= 1}
                className="btn-ghost btn-sm flex-1"
              >
                − ست
              </button>
            </div>

            <p className="text-[10px] leading-5 text-brand-300">
              تیم برنده بر اساس تعداد ست‌های برده‌شده تعیین می‌شود. جدول و براکت پس از ثبت، خودکار
              به‌روزرسانی می‌شوند.
            </p>

            <button type="button" onClick={submit} disabled={loading} className="btn-accent btn-lg w-full">
              {loading ? <Spinner /> : 'ثبت نتیجه'}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
