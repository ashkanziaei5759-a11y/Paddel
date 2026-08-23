import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CourtCreateButton } from './CourtCreateButton';
import { formatToman } from '@/lib/utils';
import { formatMinutes, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'مدیریت زمین‌ها' };
export const dynamic = 'force-dynamic';

export default async function AdminCourtsPage() {
  const courts = await prisma.court.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { bookings: true, pricingRules: true } },
    },
  });

  return (
    <>
      <AdminHeader
        title="مدیریت زمین‌ها"
        subtitle={`${toFaDigits(courts.length)} زمین ثبت شده`}
        action={<CourtCreateButton />}
      />

      <div className="grid gap-3 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:px-8 xl:grid-cols-3">
        {courts.length === 0 ? (
          <div className="card px-6 py-12 text-center lg:col-span-2 xl:col-span-3">
            <p className="text-xs font-bold text-brand-300">
              هنوز زمینی ثبت نشده است. با دکمه‌ی «زمین جدید» شروع کنید.
            </p>
          </div>
        ) : (
          courts.map((court) => (
            <Link key={court.id} href={`/admin/courts/${court.id}`} className="card-interactive block overflow-hidden">
              <div
                className={cn(
                  'relative p-4 text-white',
                  court.isActive ? 'bg-brand-gradient' : 'bg-brand-300',
                )}
              >
                <div className="absolute inset-0 bg-court-lines opacity-50" />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{court.name}</p>
                    <p className="num mt-1 text-[11px] font-bold text-sky-light/70">
                      {formatMinutes(court.openingMinute)} تا {formatMinutes(court.closingMinute)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'badge shrink-0',
                      court.isActive ? 'bg-success/25 text-white' : 'bg-white/20 text-white',
                    )}
                  >
                    {court.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                <Item label="قیمت پایه هر سانس" value={formatToman(court.basePrice)} />
                <Item label="مدت سانس" value={`${toFaDigits(court.slotDurationMinutes)} دقیقه`} />
                <Item label="قوانین قیمت" value={`${toFaDigits(court._count.pricingRules)} مورد`} />
                <Item label="کل رزروها" value={toFaDigits(court._count.bookings)} />
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-brand-300">{label}</p>
      <p className="num mt-0.5 text-xs font-extrabold text-brand-800">{value}</p>
    </div>
  );
}
