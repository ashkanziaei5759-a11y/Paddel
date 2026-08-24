'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays, LayoutList } from 'lucide-react';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { TeamCard, type TeamCardDto } from '@/components/tournament/TeamCard';
import { TournamentCalendar, type CalendarEvent } from '@/components/tournament/TournamentCalendar';
import { Dot } from '@/components/ui/Dot';
import { TOURNAMENT_STATUS_LABEL, rankLabel } from '@/lib/constants';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { cn, formatToman } from '@/lib/utils';

export interface TournamentDto {
  id: string;
  name: string;
  typeLabel: string;
  status: keyof typeof TOURNAMENT_STATUS_LABEL;
  startsAt: string;
  dayKey: string;
  maxTeams: number;
  entryFee: string;
  teams: TeamCardDto[];
  joined: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  REGISTRATION_OPEN: 'badge-accent',
  ONGOING: 'badge-success',
  REGISTRATION_CLOSED: 'badge-brand',
  COMPLETED: 'badge-muted',
  CANCELLED: 'badge-danger',
  DRAFT: 'badge-muted',
};

/** تورنومنتی که هنوز لغو یا تمام نشده، «فعال» شمرده می‌شود */
const ACTIVE = new Set(['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING']);

export function TournamentsView({
  tournaments,
  todayKey,
}: {
  tournaments: TournamentDto[];
  todayKey: string;
}) {
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const active = tournaments.filter((t) => ACTIVE.has(t.status));
  const past = tournaments.filter((t) => !ACTIVE.has(t.status));

  const events = useMemo<CalendarEvent[]>(
    () =>
      tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        dayKey: t.dayKey,
        status: t.status,
        type: t.typeLabel,
      })),
    [tournaments],
  );

  return (
    <div className="space-y-5">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: 'فهرست' },
          { value: 'calendar', label: 'تقویم' },
        ]}
      />

      {view === 'calendar' ? (
        <div className="animate-fade-up">
          <TournamentCalendar events={events} todayKey={todayKey} />
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-bold text-brand-300">
            <Legend className="bg-accent" label="ثبت‌نام باز" />
            <Legend className="bg-success" label="در جریان" />
            <Legend className="bg-brand-400" label="ثبت‌نام بسته" />
            <Legend className="bg-brand-200" label="پایان‌یافته" />
          </div>
        </div>
      ) : (
        <div className="animate-fade-up space-y-6">
          <Group title="تورنومنت فعال" items={active} />
          <Group title="برگزار شده" items={past} muted />
          {tournaments.length === 0 && (
            <EmptyState
              icon="tournament"
              title="هنوز تورنومنتی ثبت نشده است"
              description="به‌زودی مسابقات جدید باشگاه اعلام می‌شوند."
            />
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', className)} />
      {label}
    </span>
  );
}

function Group({
  title,
  items,
  muted,
}: {
  title: string;
  items: TournamentDto[];
  muted?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-extrabold text-brand-800">
        {title}
        <span className="num mr-2 text-xs font-bold text-brand-300">
          ({toFaDigits(items.length)})
        </span>
      </h2>

      <div className="space-y-4">
        {items.map((t) => (
          <div key={t.id} className={cn('space-y-2.5', muted && 'opacity-90')}>
            <Link href={`/tournaments/${t.id}`} className="card-interactive block overflow-hidden">
              <div className="relative bg-brand-gradient p-4 text-white">
                <div className="absolute inset-0 bg-court-lines opacity-50" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{t.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-sky-light/70">{t.typeLabel}</p>
                  </div>
                  <span className={cn('shrink-0', STATUS_STYLE[t.status] ?? 'badge-muted')}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between text-[11px] font-bold text-brand-400">
                  <span>{formatDateTime(t.startsAt ? new Date(t.startsAt) : new Date())}</span>
                  {t.joined && <span className="badge-success">ثبت‌نام شده</span>}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                  <span className="num text-brand-500">
                    {toFaDigits(t.teams.length)} از {toFaDigits(t.maxTeams)} تیم
                  </span>
                  {BigInt(t.entryFee) > 0n ? (
                    <span className="num text-brand-700">ورودی {formatToman(BigInt(t.entryFee))}</span>
                  ) : (
                    <span className="text-success">ورود رایگان</span>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-accent-gradient transition-all"
                    style={{ width: `${Math.min(100, (t.teams.length / Math.max(1, t.maxTeams)) * 100)}%` }}
                  />
                </div>
              </div>
            </Link>

            {/* تیم‌های ثبت‌نام‌شده با عکس پروفایل هر دو هم‌تیمی */}
            {t.teams.length > 0 && (
              <div className="space-y-2 pr-1">
                <p className="text-[10px] font-black text-brand-300">تیم‌های ثبت‌نام‌شده</p>
                {t.teams.slice(0, 4).map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    rankLabel={team.rank ? rankLabel(team.rank) : undefined}
                  />
                ))}
                {t.teams.length > 4 && (
                  <Link
                    href={`/tournaments/${t.id}`}
                    className="block py-1 text-center text-[11px] font-bold text-brand-400 hover:text-brand-600"
                  >
                    مشاهده {toFaDigits(t.teams.length - 4)} تیم دیگر
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
