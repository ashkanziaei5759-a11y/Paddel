import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { quoteRefund } from '@/lib/cancellation';
import { formatDuration, formatJalaliDate, formatTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { BOOKING_STATUS_LABEL } from '@/lib/constants';
import { CancelBookingPanel } from './CancelBookingPanel';

export const metadata: Metadata = { title: 'جزئیات رزرو' };
export const dynamic = 'force-dynamic';

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePage();
  const { id } = await params;

  const [booking, unread] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: { court: true, cancellation: true, slots: { orderBy: { startsAt: 'asc' } } },
    }),
    unreadCount(user.id),
  ]);

  if (!booking) notFound();
  if (booking.userId !== user.id && user.role !== 'ADMIN') notFound();

  const canCancel = booking.status === 'CONFIRMED' && booking.startsAt.getTime() > Date.now();
  const quote = canCancel ? await quoteRefund(booking.totalPrice, booking.startsAt) : null;

  const durationMinutes = Math.round(
    (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
  );

  return (
    <>
      <TopBar title="جزئیات رزرو" subtitle={booking.code} unread={unread} back="/bookings" />

      <div className="page-pad stagger space-y-4 pt-2">
        {/* بلیت رزرو */}
        <section className="card-dark p-5">
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-sky-light/60">کد رزرو</p>
              <p className="num mt-1 text-2xl font-black tracking-wider text-accent">
                {booking.code}
              </p>
            </div>
            <span
              className={
                booking.status === 'CONFIRMED'
                  ? 'badge bg-success/20 text-white'
                  : booking.status === 'CANCELLED'
                    ? 'badge bg-danger/25 text-white'
                    : 'badge bg-white/15 text-white'
              }
            >
              {BOOKING_STATUS_LABEL[booking.status]}
            </span>
          </div>

          <div className="relative my-5 flex items-center gap-3">
            <span className="h-5 w-5 rounded-full bg-surface-muted" />
            <span className="flex-1 border-t border-dashed border-white/25" />
            <span className="h-5 w-5 rounded-full bg-surface-muted" />
          </div>

          <div className="relative grid grid-cols-2 gap-4">
            <Field label="زمین" value={booking.court.name} />
            <Field label="مدت" value={formatDuration(durationMinutes)} />
            <Field label="تاریخ" value={formatJalaliDate(booking.startsAt, { withWeekday: true })} />
            <Field
              label="ساعت"
              value={`${formatTime(booking.startsAt)} تا ${formatTime(booking.endsAt)}`}
            />
            <Field label="تعداد سانس" value={toFaDigits(booking.slotCount)} />
            <Field label="مبلغ پرداختی" value={formatToman(booking.totalPrice)} />
          </div>
        </section>

        {/* ریز سانس‌ها */}
        {booking.slots.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">ریز سانس‌ها</h2>
            <div className="space-y-2">
              {booking.slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-2.5"
                >
                  <span className="num text-xs font-bold text-brand-600">
                    {formatTime(slot.startsAt)} — {formatTime(slot.endsAt)}
                  </span>
                  <span className="num text-xs font-extrabold text-brand-800">
                    {formatToman(slot.price)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* اطلاعات لغو */}
        {booking.cancellation && (
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-extrabold text-brand-800">اطلاعات لغو</h2>
            <div className="space-y-2 text-xs">
              <Line label="درصد کسر" value={`${toFaDigits(booking.cancellation.penaltyPercent)}٪`} />
              <Line label="مبلغ کسرشده" value={formatToman(booking.cancellation.penaltyAmount)} />
              <Line
                label="مبلغ بازگشتی به کیف پول"
                value={formatToman(booking.cancellation.refundAmount)}
                accent
              />
              {booking.cancellation.reason && (
                <Line label="دلیل" value={booking.cancellation.reason} />
              )}
            </div>
          </section>
        )}

        {/* لغو رزرو */}
        {canCancel && quote && (
          <CancelBookingPanel
            bookingId={booking.id}
            totalPrice={booking.totalPrice.toString()}
            refundAmount={quote.refundAmount.toString()}
            penaltyPercent={quote.penaltyPercent}
            policyName={quote.policyName}
          />
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-sky-light/60">{label}</p>
      <p className="num mt-1 text-xs font-black text-white">{value}</p>
    </div>
  );
}

function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-brand-400">{label}</span>
      <span className={`num font-extrabold ${accent ? 'text-success' : 'text-brand-800'}`}>{value}</span>
    </div>
  );
}
