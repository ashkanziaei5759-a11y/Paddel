'use client';

import { useMemo, useState } from 'react';
import type { Gender, PlayerLevel } from '@prisma/client';
import { Search, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { TopPlayersRail } from '@/components/ranking/TopPlayersRail';
import { EmptyState } from '@/components/ui/EmptyState';
import { LEVEL_LABEL, levelTier } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface RankRow {
  userId: string;
  rank: number;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
  level: PlayerLevel;
  points: number;
  gender: Gender | null;
  avatarHasAlpha: boolean;
  /** اختلاف رتبه نسبت به ۳۰ روز پیش — مثبت یعنی صعود */
  delta: number;
  gained: number;
}

const TIERS = ['ALL', 'A', 'B', 'C', 'D'] as const;
type Tier = (typeof TIERS)[number];

const GROUPS = [
  { value: 'ALL' as const, label: 'همه' },
  { value: 'MALE' as const, label: 'مردان' },
  { value: 'FEMALE' as const, label: 'زنان' },
];
type Group = (typeof GROUPS)[number]['value'];

export function RankingView({ rows, viewerId }: { rows: RankRow[]; viewerId: string }) {
  const [tier, setTier] = useState<Tier>('ALL');
  const [group, setGroup] = useState<Group>('ALL');
  const [query, setQuery] = useState('');

  /* تب مردان/زنان فقط وقتی معنا دارد که جنسیت دست‌کم برای یک بازیکن ثبت شده باشد */
  const hasGenders = useMemo(() => rows.some((r) => r.gender), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = rows.filter((r) => {
      if (group !== 'ALL' && r.gender !== group) return false;
      if (tier !== 'ALL' && levelTier(r.level) !== tier) return false;
      if (!q) return true;
      return `${r.firstName} ${r.lastName} ${r.username}`.includes(q);
    });
    /* با فیلتر شدن فهرست، رتبه‌ها باید پشت‌سرهم شماره بخورند تا «۱، ۴، ۹» نبینیم */
    return group === 'ALL' ? list : list.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, tier, group, query]);

  const me = filtered.find((r) => r.userId === viewerId) ?? rows.find((r) => r.userId === viewerId);
  const podium = tier === 'ALL' && !query.trim() ? filtered.slice(0, 5) : [];
  const rest = podium.length ? filtered.slice(5) : filtered;

  return (
    <div className="space-y-4">
      {/* ---- مردان / زنان ---- */}
      {hasGenders && (
        <div className="flex items-center gap-5 border-b border-brand-100 px-1">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGroup(g.value)}
              aria-pressed={group === g.value}
              className={cn(
                'relative pb-2.5 text-[13px] font-extrabold transition-colors',
                group === g.value ? 'text-brand-800' : 'text-brand-300 hover:text-brand-500',
              )}
            >
              {g.label}
              {group === g.value && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-electric-gradient" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ---- جست‌وجو ---- */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-brand-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی بازیکن"
          aria-label="جست‌وجوی بازیکن"
          className="h-12 w-full rounded-2xl border border-brand-100 bg-card pr-11 pl-4 text-sm font-semibold text-brand-800 outline-none transition placeholder:text-brand-300 focus:border-electric-500 focus:ring-4 focus:ring-electric-500/15"
        />
      </div>

      {/* ---- فیلتر سطح ---- */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            dir="ltr"
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
            className={cn(
              'shrink-0 rounded-2xl border px-5 py-2.5 text-xs font-black transition',
              tier === t
                ? 'border-transparent bg-electric-gradient text-white shadow-lift-electric'
                : 'border-brand-100 bg-card text-brand-400 hover:text-brand-600',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---- جایگاه خودِ کاربر ---- */}
      {me && (
        <div className="card-night flex items-center gap-3 p-4">
          <span className="num flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-base font-black text-white">
            {toFaDigits(me.rank)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold tracking-widest text-sky-light/60">جایگاه شما</p>
            <p className="truncate text-sm font-extrabold text-white">
              {me.firstName} {me.lastName}
            </p>
          </div>
          <div className="text-left">
            <p className="num text-lg font-black text-accent">{formatNumber(me.points)}</p>
            <p className="text-[10px] font-bold text-sky-light/60">امتیاز</p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="points"
          title="بازیکنی پیدا نشد"
          description="نام دیگری را جست‌وجو کنید یا فیلتر سطح را بردارید."
        />
      ) : (
        <>
          {/* ---- نفرات برتر ---- */}
          {podium.length > 0 && <TopPlayersRail players={podium} />}

          {/* ---- بقیه‌ی جدول ---- */}
          {rest.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="flex items-center gap-3 border-b border-brand-50 px-4 py-2.5 text-[10px] font-black text-brand-300">
                <span className="w-8 text-center">رتبه</span>
                <span className="flex-1">نام بازیکن</span>
                <span>امتیاز</span>
              </div>
              {rest.map((r) => (
                <RankRowItem key={r.userId} row={r} isViewer={r.userId === viewerId} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="px-1 text-[10.5px] font-semibold leading-6 text-brand-300">
        فلش‌ها تغییر رتبه نسبت به ۳۰ روز گذشته را نشان می‌دهند. امتیاز از تورنومنت‌ها و
        اعطای مدیریت به دست می‌آید.
      </p>
    </div>
  );
}

function RankRowItem({ row, isViewer }: { row: RankRow; isViewer: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-brand-50 px-4 py-3 last:border-0',
        /* accent-50 یک هگز ثابت کرم است و در تم تیره برنمی‌گردد، در حالی که
           متن ردیف سفید می‌شود؛ پس تهِ رنگ را از خود accent با شفافیت
           می‌سازیم تا روی هر دو تم زیر متن بنشیند. */
        isViewer && 'bg-accent/10',
      )}
    >
      <span className="num w-8 shrink-0 text-center text-sm font-black text-brand-400">
        {toFaDigits(row.rank)}
      </span>

      <Avatar firstName={row.firstName} lastName={row.lastName} src={row.avatarUrl} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-extrabold text-brand-800">
          {row.firstName} {row.lastName}
        </p>
        <span dir="ltr" className="mt-0.5 block text-[10px] font-black text-brand-300">
          {LEVEL_LABEL[row.level]}
        </span>
      </div>

      <Trend delta={row.delta} />

      <span className="num w-12 shrink-0 text-left text-sm font-black text-brand-700">
        {formatNumber(row.points)}
      </span>
    </div>
  );
}

/** فلش تغییر رتبه — سبز صعود، قرمز نزول، خط تیره یعنی بدون تغییر */
function Trend({ delta }: { delta: number }) {
  if (delta === 0) {
    return <Minus className="h-4 w-4 shrink-0 text-brand-200" aria-label="بدون تغییر" />;
  }
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-0.5 text-[10px] font-black',
        up ? 'text-success' : 'text-danger',
      )}
      aria-label={`${up ? 'صعود' : 'نزول'} ${toFaDigits(Math.abs(delta))} پله`}
    >
      <Icon className="h-4 w-4" />
      <span className="num">{toFaDigits(Math.abs(delta))}</span>
    </span>
  );
}
