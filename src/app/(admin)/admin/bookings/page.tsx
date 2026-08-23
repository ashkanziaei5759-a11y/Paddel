import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBookingRow } from './AdminBookingRow';
import { BookingFilters } from './BookingFilters';
import { addDays, dayKey, parseDayKey, toFaDigits, zonedToUtc } from '@/lib/datetime';
import { formatToman, iso } from '@/lib/utils';

export const metadata: Metadata = { title: 'مدیریت رزروها' };
export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; courtId?: string; status?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  const scope = sp.scope ?? 'upcoming';
  const now = new Date();

  let dateFilter: { gte?: Date; lt?: Date } = {};
  if (sp.date) {
    const { gy, gm, gd } = parseDayKey(sp.date);
    const start = zonedToUtc(gy, gm, gd, 0);
    dateFilter = { gte: start, lt: addDays(start, 1) };
  } else if (scope === 'upcoming') {
    dateFilter = { gte: now };
  } else if (scope === 'past') {
    dateFilter = { lt: now };
  }

  const [bookings, courts, totals] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ...(Object.keys(dateFilter).length ? { startsAt: dateFilter } : {}),
        ...(sp.courtId ? { courtId: sp.courtId } : {}),
        ...(sp.status ? { status: sp.status as never } : {}),
      },
      orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
      take: 150,
      include: {
        court: { select: { name: true } },
        user: { include: { profile: true } },
        cancellation: true,
      },
    }),
    prisma.court.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.booking.aggregate({
      where: {
        ...(Object.keys(dateFilter).length ? { startsAt: dateFilter } : {}),
        ...(sp.courtId ? { courtId: sp.courtId } : {}),
        status: { not: 'CANCELLED' },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
  ]);

  return (
    <>
      <AdminHeader
        title="مدیریت رزروها"
        subtitle={`${iso(toFaDigits(bookings.length))} رزرو · ${iso(`مجموع ${formatToman(totals._sum.totalPrice ?? 0n)}`)}`}
      />

      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <BookingFilters
          courts={courts}
          defaultDate={sp.date ?? ''}
          defaultCourtId={sp.courtId ?? ''}
          defaultStatus={sp.status ?? ''}
          defaultScope={scope}
          todayKey={dayKey(now)}
        />

        {bookings.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="text-xs font-bold text-brand-300">رزروی با این فیلترها یافت نشد.</p>
          </div>
        ) : (
          <div className="card divide-y divide-brand-50 overflow-hidden">
            {bookings.map((b) => (
              <AdminBookingRow
                key={b.id}
                booking={{
                  id: b.id,
                  code: b.code,
                  startsAt: b.startsAt.toISOString(),
                  endsAt: b.endsAt.toISOString(),
                  slotCount: b.slotCount,
                  status: b.status,
                  totalPrice: b.totalPrice.toString(),
                  courtName: b.court.name,
                  userName: `${b.user.profile?.firstName ?? ''} ${b.user.profile?.lastName ?? ''}`.trim(),
                  username: b.user.username,
                  userId: b.userId,
                  refundAmount: b.cancellation?.refundAmount.toString() ?? null,
                }}
              />
            ))}
          </div>
        )}

        <p className="text-center text-[11px] font-bold text-brand-300">
          <Link href="/admin/finance" className="hover:text-brand-600">
            مشاهده گزارش مالی کامل ←
          </Link>
        </p>
      </div>
    </>
  );
}
