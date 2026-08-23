import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CourtEditor } from './CourtEditor';
import { PricingRules } from './PricingRules';
import { formatToman } from '@/lib/utils';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { BOOKING_STATUS_LABEL } from '@/lib/constants';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'ویرایش زمین' };
export const dynamic = 'force-dynamic';

export default async function AdminCourtDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const court = await prisma.court.findUnique({
    where: { id },
    include: {
      pricingRules: { orderBy: [{ priority: 'desc' }, { startMinute: 'asc' }] },
      bookings: {
        where: { startsAt: { gte: new Date() }, status: { not: 'CANCELLED' } },
        orderBy: { startsAt: 'asc' },
        take: 20,
        include: { user: { include: { profile: true } } },
      },
    },
  });

  if (!court) notFound();

  return (
    <>
      <AdminHeader
        title={court.name}
        subtitle="ویرایش مشخصات، قیمت‌گذاری و رزروها"
        action={
          <Link href="/admin/courts" className="btn-outline btn-sm">
            بازگشت
          </Link>
        }
      />

      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:px-8">
        <CourtEditor
          court={{
            id: court.id,
            name: court.name,
            description: court.description,
            imageUrl: court.imageUrl,
            isActive: court.isActive,
            basePrice: court.basePrice.toString(),
            slotDurationMinutes: court.slotDurationMinutes,
            openingMinute: court.openingMinute,
            closingMinute: court.closingMinute,
            maxConsecutiveSlots: court.maxConsecutiveSlots,
            minLeadTimeMinutes: court.minLeadTimeMinutes,
            advanceBookingDays: court.advanceBookingDays,
            sortOrder: court.sortOrder,
          }}
        />

        <PricingRules
          courtId={court.id}
          basePrice={court.basePrice.toString()}
          rules={court.pricingRules.map((r) => ({
            id: r.id,
            name: r.name,
            startMinute: r.startMinute,
            endMinute: r.endMinute,
            daysOfWeek: r.daysOfWeek,
            price: r.price.toString(),
            priority: r.priority,
            isActive: r.isActive,
          }))}
        />

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">رزروهای پیش‌رو این زمین</h2>
          {court.bookings.length === 0 ? (
            <div className="card px-6 py-8 text-center">
              <p className="text-xs font-bold text-brand-300">رزرو پیش‌رویی برای این زمین ثبت نشده است.</p>
            </div>
          ) : (
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {court.bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center gap-3 p-3.5 transition hover:bg-brand-50/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {b.user.profile?.firstName} {b.user.profile?.lastName}
                    </p>
                    <p className="num text-[10px] font-semibold text-brand-400">
                      {formatDateTime(b.startsAt)} <Dot />{toFaDigits(b.slotCount)} سانس
                    </p>
                  </div>
                  <span className="num text-[11px] font-bold text-brand-600">
                    {formatToman(b.totalPrice, { withUnit: false })}
                  </span>
                  <span className="badge-muted shrink-0">{BOOKING_STATUS_LABEL[b.status]}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
