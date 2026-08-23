import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { TournamentForm, type TournamentFormValues } from '@/components/admin/TournamentForm';

export const metadata: Metadata = { title: 'تورنومنت جدید' };
export const dynamic = 'force-dynamic';

export default async function NewTournamentPage() {
  const courts = await prisma.court.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  });

  const start = new Date(Date.now() + 7 * 86_400_000);
  const end = new Date(start.getTime() + 6 * 3_600_000);

  const initial: TournamentFormValues = {
    name: '',
    description: '',
    type: 'GROUP_KNOCKOUT',
    status: 'DRAFT',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    registrationClosesAt: new Date(start.getTime() - 2 * 86_400_000).toISOString(),
    maxTeams: 8,
    minTeams: 4,
    entryFeeToman: 0,
    splitFeeBetweenPartners: false,
    partnerMode: 'PLAYER_CHOICE',
    courtIds: courts.map((c) => c.id),
    groupCount: 2,
    advancingPerGroup: 2,
    hasThirdPlaceMatch: true,
    doubleRoundRobin: false,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0,
    levelRuleType: 'FREE',
    slot1Levels: [],
    slot2Levels: [],
    combinations: [],
    orderInsensitive: true,
    levelRuleDescription: '',
    pointsRules: [
      { rank: 1, pointsPerPlayer: 100 },
      { rank: 2, pointsPerPlayer: 50 },
      { rank: 3, pointsPerPlayer: 30 },
    ],
  };

  return (
    <>
      <AdminHeader
        title="تورنومنت جدید"
        subtitle="تعریف قوانین، ظرفیت، سطح‌بندی و امتیازها"
        action={
          <Link href="/admin/tournaments" className="btn-outline btn-sm">
            بازگشت
          </Link>
        }
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <TournamentForm courts={courts} initial={initial} />
      </div>
    </>
  );
}
