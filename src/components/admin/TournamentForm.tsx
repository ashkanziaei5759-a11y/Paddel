'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PlayerLevel } from '@prisma/client';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { LEVEL_LABEL, LEVEL_ORDER, rankLabel } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PointsRuleInput {
  rank: number;
  pointsPerPlayer: number;
  label?: string | null;
}

export interface TournamentFormValues {
  id?: string;
  name: string;
  description: string;
  type: 'LEAGUE' | 'GROUP_KNOCKOUT';
  status: string;
  startsAt: string;
  endsAt: string;
  registrationClosesAt: string;
  maxTeams: number;
  minTeams: number;
  entryFeeToman: number;
  splitFeeBetweenPartners: boolean;
  partnerMode: 'PLAYER_CHOICE' | 'LEADER_DRAFT' | 'ADMIN_ASSIGN';
  courtIds: string[];
  groupCount: number;
  advancingPerGroup: number;
  hasThirdPlaceMatch: boolean;
  doubleRoundRobin: boolean;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  levelRuleType: 'FREE' | 'EXACT' | 'RANGE' | 'COMBINATION';
  slot1Levels: PlayerLevel[];
  slot2Levels: PlayerLevel[];
  combinations: { slot1: PlayerLevel; slot2: PlayerLevel }[];
  orderInsensitive: boolean;
  levelRuleDescription: string;
  pointsRules: PointsRuleInput[];
}

/** تبدیل تاریخ ISO به قالب ورودی datetime-local (وقت محلی مرورگر) */
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function TournamentForm({
  courts,
  initial,
}: {
  courts: { id: string; name: string }[];
  initial: TournamentFormValues;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [v, setV] = useState<TournamentFormValues>(initial);

  const set = <K extends keyof TournamentFormValues>(key: K, value: TournamentFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const toggleLevel = (slot: 'slot1Levels' | 'slot2Levels', level: PlayerLevel) =>
    setV((prev) => ({
      ...prev,
      [slot]: prev[slot].includes(level)
        ? prev[slot].filter((l) => l !== level)
        : [...prev[slot], level],
    }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const payload = {
      name: v.name,
      description: v.description || null,
      type: v.type,
      status: v.status,
      startsAt: new Date(v.startsAt).toISOString(),
      endsAt: new Date(v.endsAt).toISOString(),
      registrationClosesAt: v.registrationClosesAt
        ? new Date(v.registrationClosesAt).toISOString()
        : null,
      maxTeams: v.maxTeams,
      minTeams: v.minTeams,
      entryFeeToman: v.entryFeeToman,
      splitFeeBetweenPartners: v.splitFeeBetweenPartners,
      partnerMode: v.partnerMode,
      courtIds: v.courtIds,
      groupCount: v.type === 'GROUP_KNOCKOUT' ? v.groupCount : null,
      advancingPerGroup: v.type === 'GROUP_KNOCKOUT' ? v.advancingPerGroup : null,
      hasThirdPlaceMatch: v.hasThirdPlaceMatch,
      doubleRoundRobin: v.doubleRoundRobin,
      pointsForWin: v.pointsForWin,
      pointsForDraw: v.pointsForDraw,
      pointsForLoss: v.pointsForLoss,
      levelRule: {
        type: v.levelRuleType,
        slot1Levels: v.slot1Levels,
        slot2Levels: v.slot2Levels,
        combinations: v.combinations,
        orderInsensitive: v.orderInsensitive,
        description: v.levelRuleDescription || null,
      },
      pointsRules: v.pointsRules.filter((r) => r.pointsPerPlayer > 0),
    };

    try {
      const res = await fetch(
        v.id ? `/api/admin/tournaments/${v.id}` : '/api/admin/tournaments',
        {
          method: v.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();

      if (!res.ok || !json.ok) { toast.error(json.error || 'ذخیره ناموفق بود.'); return; }

      toast.success(v.id ? 'تورنومنت به‌روزرسانی شد.' : 'تورنومنت ایجاد شد.');
      router.push(`/admin/tournaments/${json.data.id}`);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
      {/* ---- اطلاعات پایه ---- */}
      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-extrabold text-brand-800">اطلاعات پایه</h2>

        <div>
          <label className="label" htmlFor="t-name">نام تورنومنت</label>
          <input
            id="t-name" value={v.name} onChange={(e) => set('name', e.target.value)}
            className="field" placeholder="جام تابستانه پرشین پدل" required
          />
        </div>

        <div>
          <label className="label" htmlFor="t-desc">توضیحات</label>
          <textarea
            id="t-desc" value={v.description} onChange={(e) => set('description', e.target.value)}
            rows={3} className="field resize-none" placeholder="قوانین، جوایز و نکات مهم…"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="t-type">نوع تورنومنت</label>
            <select
              id="t-type" value={v.type}
              onChange={(e) => set('type', e.target.value as TournamentFormValues['type'])}
              className="field"
            >
              <option value="LEAGUE">لیگ (دوره‌ای)</option>
              <option value="GROUP_KNOCKOUT">مرحله گروهی + حذفی</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-status">وضعیت</label>
            <select id="t-status" value={v.status} onChange={(e) => set('status', e.target.value)} className="field">
              <option value="DRAFT">پیش‌نویس</option>
              <option value="REGISTRATION_OPEN">ثبت‌نام باز</option>
              <option value="REGISTRATION_CLOSED">ثبت‌نام بسته</option>
              <option value="ONGOING">در حال برگزاری</option>
              <option value="COMPLETED">پایان یافته</option>
              <option value="CANCELLED">لغو شده</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="t-start">شروع</label>
            <input
              id="t-start" type="datetime-local" dir="ltr" className="field text-left"
              value={toLocalInput(v.startsAt)}
              onChange={(e) => set('startsAt', new Date(e.target.value).toISOString())} required
            />
          </div>
          <div>
            <label className="label" htmlFor="t-end">پایان</label>
            <input
              id="t-end" type="datetime-local" dir="ltr" className="field text-left"
              value={toLocalInput(v.endsAt)}
              onChange={(e) => set('endsAt', new Date(e.target.value).toISOString())} required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-regclose">مهلت ثبت‌نام</label>
          <input
            id="t-regclose" type="datetime-local" dir="ltr" className="field text-left"
            value={toLocalInput(v.registrationClosesAt)}
            onChange={(e) =>
              set('registrationClosesAt', e.target.value ? new Date(e.target.value).toISOString() : '')
            }
          />
        </div>

        <div>
          <label className="label">زمین‌های مورد استفاده</label>
          <div className="flex flex-wrap gap-2">
            {courts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  set(
                    'courtIds',
                    v.courtIds.includes(c.id)
                      ? v.courtIds.filter((x) => x !== c.id)
                      : [...v.courtIds, c.id],
                  )
                }
                className={cn(
                  'rounded-xl px-3 py-2 text-[11px] font-bold transition-all',
                  v.courtIds.includes(c.id)
                    ? 'bg-brand-gradient text-white shadow-card'
                    : 'bg-surface-muted text-brand-500 hover:bg-brand-50',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- ظرفیت و هزینه ---- */}
      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-extrabold text-brand-800">ظرفیت، هزینه و تیم‌بندی</h2>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="t-max">حداکثر تیم</label>
            <input
              id="t-max" type="number" dir="ltr" className="field num text-left"
              value={v.maxTeams} min={2} max={128}
              onChange={(e) => set('maxTeams', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-min">حداقل تیم</label>
            <input
              id="t-min" type="number" dir="ltr" className="field num text-left"
              value={v.minTeams} min={2} max={128}
              onChange={(e) => set('minTeams', Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-fee">هزینه ثبت‌نام هر تیم (تومان)</label>
          <input
            id="t-fee" inputMode="numeric" dir="ltr" className="field num text-left"
            value={v.entryFeeToman}
            onChange={(e) => set('entryFeeToman', Number(e.target.value.replace(/\D/g, '')) || 0)}
          />
        </div>

        <label className="flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
          <input
            type="checkbox" checked={v.splitFeeBetweenPartners}
            onChange={(e) => set('splitFeeBetweenPartners', e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          <span className="text-xs font-bold text-brand-600">هزینه بین دو بازیکن تقسیم شود</span>
        </label>

        <div>
          <label className="label" htmlFor="t-partner">نحوه تشکیل تیم</label>
          <select
            id="t-partner" value={v.partnerMode}
            onChange={(e) => set('partnerMode', e.target.value as TournamentFormValues['partnerMode'])}
            className="field"
          >
            <option value="PLAYER_CHOICE">انتخاب پارتنر توسط بازیکنان</option>
            <option value="LEADER_DRAFT">انتخاب توسط لیدرها (Draft)</option>
            <option value="ADMIN_ASSIGN">تعیین توسط مدیریت</option>
          </select>
        </div>

        {v.type === 'GROUP_KNOCKOUT' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="t-groups">تعداد گروه‌ها</label>
              <input
                id="t-groups" type="number" dir="ltr" className="field num text-left"
                value={v.groupCount} min={1} max={16}
                onChange={(e) => set('groupCount', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="t-advance">صعود از هر گروه</label>
              <input
                id="t-advance" type="number" dir="ltr" className="field num text-left"
                value={v.advancingPerGroup} min={1} max={8}
                onChange={(e) => set('advancingPerGroup', Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          {v.type === 'GROUP_KNOCKOUT' && (
            <label className="flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
              <input
                type="checkbox" checked={v.hasThirdPlaceMatch}
                onChange={(e) => set('hasThirdPlaceMatch', e.target.checked)}
                className="h-4 w-4 accent-brand-700"
              />
              <span className="text-xs font-bold text-brand-600">مسابقه رده‌بندی برگزار شود</span>
            </label>
          )}
          <label className="flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <input
              type="checkbox" checked={v.doubleRoundRobin}
              onChange={(e) => set('doubleRoundRobin', e.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            <span className="text-xs font-bold text-brand-600">مسابقات رفت و برگشت</span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label" htmlFor="t-pw">امتیاز برد</label>
            <input
              id="t-pw" type="number" dir="ltr" className="field num text-left"
              value={v.pointsForWin} min={0} max={10}
              onChange={(e) => set('pointsForWin', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-pd">امتیاز مساوی</label>
            <input
              id="t-pd" type="number" dir="ltr" className="field num text-left"
              value={v.pointsForDraw} min={0} max={10}
              onChange={(e) => set('pointsForDraw', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-pl">امتیاز باخت</label>
            <input
              id="t-pl" type="number" dir="ltr" className="field num text-left"
              value={v.pointsForLoss} min={0} max={10}
              onChange={(e) => set('pointsForLoss', Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* ---- قوانین سطح ---- */}
      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-extrabold text-brand-800">قوانین سطح بازیکنان</h2>
        <p className="text-[11px] leading-6 text-brand-400">
          هنگام انتخاب پارتنر، سیستم به‌صورت خودکار بررسی می‌کند که ترکیب سطح دو بازیکن با این قانون
          سازگار باشد.
        </p>

        <div>
          <label className="label" htmlFor="t-rule">نوع قانون</label>
          <select
            id="t-rule" value={v.levelRuleType}
            onChange={(e) => set('levelRuleType', e.target.value as TournamentFormValues['levelRuleType'])}
            className="field"
          >
            <option value="FREE">آزاد — هر ترکیبی مجاز است</option>
            <option value="EXACT">سطح دقیق — هر جایگاه سطح مشخص</option>
            <option value="RANGE">بازه سطح — هر جایگاه در محدوده‌ای از سطوح</option>
            <option value="COMBINATION">ترکیب‌های مشخص</option>
          </select>
        </div>

        {(v.levelRuleType === 'EXACT' || v.levelRuleType === 'RANGE') && (
          <>
            <LevelPicker
              label={v.levelRuleType === 'RANGE' ? 'بازه سطح بازیکن اول' : 'سطوح مجاز بازیکن اول'}
              selected={v.slot1Levels}
              onToggle={(l) => toggleLevel('slot1Levels', l)}
            />
            <LevelPicker
              label={v.levelRuleType === 'RANGE' ? 'بازه سطح بازیکن دوم' : 'سطوح مجاز بازیکن دوم'}
              selected={v.slot2Levels}
              onToggle={(l) => toggleLevel('slot2Levels', l)}
            />
          </>
        )}

        {v.levelRuleType === 'COMBINATION' && (
          <CombinationEditor
            combinations={v.combinations}
            onChange={(next) => set('combinations', next)}
          />
        )}

        {v.levelRuleType !== 'FREE' && (
          <label className="flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <input
              type="checkbox" checked={v.orderInsensitive}
              onChange={(e) => set('orderInsensitive', e.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            <span className="text-xs font-bold text-brand-600">
              ترتیب جایگاه‌ها مهم نباشد (A+B معادل B+A)
            </span>
          </label>
        )}

        <div>
          <label className="label" htmlFor="t-ruledesc">توضیح قانون برای بازیکنان</label>
          <input
            id="t-ruledesc" value={v.levelRuleDescription}
            onChange={(e) => set('levelRuleDescription', e.target.value)}
            className="field" placeholder="مثلاً: یک بازیکن A و یک بازیکن B"
          />
        </div>
      </section>

      {/* ---- امتیاز تیم‌های برتر ---- */}
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-brand-800">امتیاز تیم‌های برتر ⭐</h2>
          <button
            type="button"
            onClick={() =>
              set('pointsRules', [
                ...v.pointsRules,
                { rank: v.pointsRules.length + 1, pointsPerPlayer: 0 },
              ])
            }
            className="btn-outline btn-sm"
          >
            + افزودن رتبه
          </button>
        </div>
        <p className="text-[11px] leading-6 text-brand-400">
          پس از ثبت نتایج نهایی، این امتیازها به‌صورت خودکار به هر بازیکنِ تیم‌های برتر اضافه می‌شود.
        </p>

        <div className="space-y-2">
          {v.pointsRules.length === 0 ? (
            <p className="py-4 text-center text-xs font-bold text-brand-300">
              رتبه‌ای تعریف نشده — امتیازی اعطا نخواهد شد.
            </p>
          ) : (
            v.pointsRules.map((rule, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="w-24">
                  <label className="label">رتبه</label>
                  <input
                    type="number" dir="ltr" className="field num text-left"
                    value={rule.rank} min={1} max={64}
                    onChange={(e) => {
                      const next = [...v.pointsRules];
                      next[index] = { ...rule, rank: Number(e.target.value) };
                      set('pointsRules', next);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="label">امتیاز هر بازیکن ({rankLabel(rule.rank)})</label>
                  <input
                    type="number" dir="ltr" className="field num text-left"
                    value={rule.pointsPerPlayer} min={0} max={100000}
                    onChange={(e) => {
                      const next = [...v.pointsRules];
                      next[index] = { ...rule, pointsPerPlayer: Number(e.target.value) };
                      set('pointsRules', next);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => set('pointsRules', v.pointsRules.filter((_, i) => i !== index))}
                  className="btn-sm mb-1 rounded-xl px-3 py-2.5 text-xs font-bold text-danger hover:bg-danger/10"
                >
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="lg:col-span-2">
        <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
          {loading ? <Spinner /> : v.id ? 'ذخیره تغییرات' : 'ایجاد تورنومنت'}
        </button>
      </div>
    </form>
  );
}

function LevelPicker({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: PlayerLevel[];
  onToggle: (level: PlayerLevel) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-6 gap-1.5">
        {LEVEL_ORDER.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onToggle(level)}
            className={cn(
              'h-9 rounded-xl text-[11px] font-black transition-all',
              selected.includes(level)
                ? 'bg-brand-gradient text-white shadow-card'
                : 'bg-surface-muted text-brand-400 hover:bg-brand-50',
            )}
          >
            {LEVEL_LABEL[level]}
          </button>
        ))}
      </div>
    </div>
  );
}

function CombinationEditor({
  combinations,
  onChange,
}: {
  combinations: { slot1: PlayerLevel; slot2: PlayerLevel }[];
  onChange: (next: { slot1: PlayerLevel; slot2: PlayerLevel }[]) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label mb-0">ترکیب‌های مجاز</label>
        <button
          type="button"
          onClick={() => onChange([...combinations, { slot1: 'A', slot2: 'B' }])}
          className="btn-outline btn-sm"
        >
          + ترکیب
        </button>
      </div>

      <div className="space-y-2">
        {combinations.length === 0 ? (
          <p className="py-3 text-center text-[11px] font-bold text-brand-300">
            ترکیبی تعریف نشده است.
          </p>
        ) : (
          combinations.map((combo, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={combo.slot1}
                onChange={(e) => {
                  const next = [...combinations];
                  next[index] = { ...combo, slot1: e.target.value as PlayerLevel };
                  onChange(next);
                }}
                className="field flex-1"
              >
                {LEVEL_ORDER.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </select>
              <span className="text-xs font-black text-brand-300">+</span>
              <select
                value={combo.slot2}
                onChange={(e) => {
                  const next = [...combinations];
                  next[index] = { ...combo, slot2: e.target.value as PlayerLevel };
                  onChange(next);
                }}
                className="field flex-1"
              >
                {LEVEL_ORDER.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(combinations.filter((_, i) => i !== index))}
                className="rounded-xl px-3 py-2.5 text-xs font-bold text-danger hover:bg-danger/10"
              >
                حذف
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
