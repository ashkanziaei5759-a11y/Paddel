import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { BOOKING_STATUS_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'تاریخچه رزرو' };
export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'badge-success',
  PENDING: 'badge-accent',
  CANCELLED: 'badge-danger',
  COMPLETED: 'badge-brand',
  NO_SHOW: 'badge-muted',
};

export default async function BookingsPage() {
  const user = await requirePage();
  const now = new Date();

  const [bookings, unread] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: { court: { select: { name: true } }, cancellation: true },
    }),
    unreadCount(user.id),
  ]);

  const upcoming = bookings.filter((b) => b.startsAt >= now && b.status === 'CONFIRMED');
  const past = bookings.filter((b) => !(b.startsAt >= now && b.status === 'CONFIRMED'));

  return (
    <>
      <TopBar title="تاریخچه حضور" subtitle="رزروهای شما" unread={unread} back="/profile" />

      <div className="page-pad space-y-6 pt-2">
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">
            رزروهای پیش‌رو
            {upcoming.length > 0 && (
              <span className="num mr-2 text-xs font-bold text-brand-300">
                ({toFaDigits(upcoming.length)})
              </span>
            )}
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              icon="booking"
              title="رزرو پیش‌رویی ندارید"
              actionLabel="رزرو زمین"
              actionHref="/booking"
            />
          ) : (
            <div className="stagger space-y-3">
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">
              رزروهای گذشته
              <span className="num mr-2 text-xs font-bold text-brand-300">
                ({toFaDigits(past.length)})
              </span>
            </h2>
            <div className="space-y-3">
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} muted />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

type BookingRow = {
  id: string;
  code: string;
  startsAt: Date;
  endsAt: Date;
  slotCount: number;
  status: keyof typeof BOOKING_STATUS_LABEL;
  totalPrice: bigint;
  court: { name: string };
  cancellation: { refundAmount: bigint } | null;
};

function BookingCard({ booking, muted }: { booking: BookingRow; muted?: boolean }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className={cn('card-interactive block p-4', muted && 'opacity-80')}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl',
            booking.status === 'CANCELLED'
              ? 'bg-brand-50 text-brand-300'
              : 'bg-brand-gradient text-white',
          )}
        >
          <span className="num text-sm font-black leading-none">{formatTime(booking.startsAt)}</span>
          <span className="mt-1 text-[8px] font-bold opacity-70">
            {formatJalaliDate(booking.startsAt, { short: true })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-extrabold text-brand-800">{booking.court.name}</p>
            <span className={cn('shrink-0', STATUS_STYLE[booking.status] ?? 'badge-muted')}>
              {BOOKING_STATUS_LABEL[booking.status]}
            </span>
          </div>
          <p className="num mt-1 text-[11px] font-semibold text-brand-400">
            {formatJalaliDate(booking.startsAt, { withWeekday: true })} <Dot />
            {formatTime(booking.startsAt)}
            {' تا '}
            {formatTime(booking.endsAt)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="num badge-muted">{booking.code}</span>
            <span className="num text-[11px] font-bold text-brand-600">
              {formatToman(booking.totalPrice)}
            </span>
            {booking.cancellation && booking.cancellation.refundAmount > 0n && (
              <span className="num badge-success">
                بازگشت {formatToman(booking.cancellation.refundAmount)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
