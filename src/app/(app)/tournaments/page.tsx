import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { formatDateTime, formatJalaliDate, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { TOURNAMENT_STATUS_LABEL, TOURNAMENT_TYPE_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'تورنومنت‌ها' };
export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  REGISTRATION_OPEN: 'badge-accent',
  ONGOING: 'badge-success',
  REGISTRATION_CLOSED: 'badge-brand',
  COMPLETED: 'badge-muted',
  CANCELLED: 'badge-danger',
  DRAFT: 'badge-muted',
};

export default async function TournamentsPage() {
  const user = await requirePage();

  const [tournaments, unread, myTeamIds] = await Promise.all([
    prisma.tournament.findMany({
      where: user.role === 'ADMIN' ? {} : { status: { not: 'DRAFT' } },
      orderBy: { startsAt: 'desc' },
      take: 60,
      include: { _count: { select: { teams: true } } },
    }),
    unreadCount(user.id),
    prisma.teamMember
      .findMany({ where: { userId: user.id }, select: { team: { select: { tournamentId: true } } } })
      .then((rows) => new Set(rows.map((r) => r.team.tournamentId))),
  ]);

  const active = tournaments.filter((t) => t.status === 'ONGOING');
  const upcoming = tournaments.filter(
    (t) => t.status === 'REGISTRATION_OPEN' || t.status === 'REGISTRATION_CLOSED' || t.status === 'DRAFT',
  );
  const past = tournaments.filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');

  return (
    <>
      <TopBar title="تورنومنت‌ها 🏆" subtitle="مسابقات باشگاه پرشین پدل" unread={unread} />

      <div className="page-pad space-y-6 pt-2">
        <Group title="در حال برگزاری" items={active} myTeamIds={myTeamIds} />
        <Group title="پیش‌رو و ثبت‌نام" items={upcoming} myTeamIds={myTeamIds} />
        <Group title="برگزار شده" items={past} myTeamIds={myTeamIds} muted />

        {tournaments.length === 0 && (
          <EmptyState
            icon="🏆"
            title="هنوز تورنومنتی ثبت نشده است"
            description="به‌زودی مسابقات جدید باشگاه اعلام می‌شوند."
          />
        )}
      </div>
    </>
  );
}

type Row = {
  id: string;
  name: string;
  type: keyof typeof TOURNAMENT_TYPE_LABEL;
  status: keyof typeof TOURNAMENT_STATUS_LABEL;
  startsAt: Date;
  maxTeams: number;
  entryFee: bigint;
  _count: { teams: number };
};

function Group({
  title,
  items,
  myTeamIds,
  muted,
}: {
  title: string;
  items: Row[];
  myTeamIds: Set<string>;
  muted?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-extrabold text-brand-800">
        {title}
        <span className="num mr-2 text-xs font-bold text-brand-300">({toFaDigits(items.length)})</span>
      </h2>
      <div className="stagger space-y-3">
        {items.map((t) => {
          const fill = Math.min(100, (t._count.teams / Math.max(1, t.maxTeams)) * 100);
          const joined = myTeamIds.has(t.id);
          return (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className={cn('card-interactive block overflow-hidden', muted && 'opacity-85')}
            >
              <div className="relative bg-brand-gradient p-4 text-white">
                <div className="absolute inset-0 bg-court-lines opacity-50" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{t.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-sky-light/70">
                      {TOURNAMENT_TYPE_LABEL[t.type]}
                    </p>
                  </div>
                  <span className={cn('shrink-0', STATUS_STYLE[t.status] ?? 'badge-muted')}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between text-[11px] font-bold text-brand-400">
                  <span>{formatDateTime(t.startsAt)}</span>
                  {joined && <span className="badge-success">ثبت‌نام شده ✓</span>}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                  <span className="num text-brand-500">
                    {toFaDigits(t._count.teams)} از {toFaDigits(t.maxTeams)} تیم
                  </span>
                  {t.entryFee > 0n ? (
                    <span className="num text-brand-700">ورودی {formatToman(t.entryFee)}</span>
                  ) : (
                    <span className="text-success">ورود رایگان</span>
                  )}
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-accent-gradient transition-all"
                    style={{ width: `${fill}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
