import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { TOURNAMENT_STATUS_LABEL, TOURNAMENT_TYPE_LABEL } from '@/lib/constants';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'مدیریت تورنومنت‌ها' };
export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  REGISTRATION_OPEN: 'badge-accent',
  ONGOING: 'badge-success',
  REGISTRATION_CLOSED: 'badge-brand',
  COMPLETED: 'badge-muted',
  CANCELLED: 'badge-danger',
  DRAFT: 'badge-muted',
};

export default async function AdminTournamentsPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startsAt: 'desc' },
    include: { _count: { select: { teams: true, matches: true } } },
  });

  return (
    <>
      <AdminHeader
        title="مدیریت تورنومنت‌ها"
        subtitle={`${toFaDigits(tournaments.length)} تورنومنت`}
        action={
          <Link href="/admin/tournaments/new" className="btn-accent btn-sm">
            + تورنومنت جدید
          </Link>
        }
      />

      <div className="grid gap-3 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:px-8 xl:grid-cols-3">
        {tournaments.length === 0 ? (
          <div className="card px-6 py-12 text-center lg:col-span-2 xl:col-span-3">
            <p className="text-xs font-bold text-brand-300">
              هنوز تورنومنتی ثبت نشده است. با دکمه‌ی «تورنومنت جدید» شروع کنید.
            </p>
          </div>
        ) : (
          tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/admin/tournaments/${t.id}`}
              className="card-interactive block overflow-hidden"
            >
              <div className="relative bg-brand-gradient p-4 text-white">
                <div className="absolute inset-0 bg-court-lines opacity-50" />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{t.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-sky-light/70">
                      {TOURNAMENT_TYPE_LABEL[t.type]}
                    </p>
                  </div>
                  <span className={cn('shrink-0', STATUS_STYLE[t.status])}>
                    {TOURNAMENT_STATUS_LABEL[t.status]}
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <p className="text-[11px] font-bold text-brand-400">{formatDateTime(t.startsAt)}</p>
                <div className="flex items-center justify-between text-[11px] font-bold text-brand-500">
                  <span className="num">
                    {toFaDigits(t._count.teams)} / {toFaDigits(t.maxTeams)} تیم
                  </span>
                  <span className="num">{toFaDigits(t._count.matches)} مسابقه</span>
                  <span className="num text-brand-700">
                    {t.entryFee > 0n ? formatToman(t.entryFee, { withUnit: false }) : 'رایگان'}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-accent-gradient"
                    style={{ width: `${Math.min(100, (t._count.teams / Math.max(1, t.maxTeams)) * 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
