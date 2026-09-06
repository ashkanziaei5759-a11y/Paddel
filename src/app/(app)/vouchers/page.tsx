import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dot } from '@/components/ui/Dot';
import { unreadCount } from '@/lib/notifications';
import { VOUCHER_KIND_LABEL, VOUCHER_STATUS_LABEL } from '@/lib/constants';
import { formatJalaliDate, toFaDigits } from '@/lib/datetime';
import { formatToman, cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'بن‌های رزرو' };
export const dynamic = 'force-dynamic';

/**
 * بن‌های رزروی که بازیکن با امتیاز خریده است.
 *
 * بن‌های تاریخ‌گذشته پیش از نمایش منقضی علامت می‌خورند، وگرنه تا اولین
 * تلاش برای استفاده در فهرست «قابل استفاده» می‌مانند و کاربر را گمراه
 * می‌کنند.
 */
export default async function VouchersPage() {
  const user = await requirePage();

  await prisma.bookingVoucher.updateMany({
    where: { userId: user.id, status: 'ACTIVE', expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED' },
  });

  const [vouchers, unread] = await Promise.all([
    prisma.bookingVoucher.findMany({
      where: { userId: user.id },
      orderBy: [{ status: 'asc' }, { expiresAt: 'asc' }],
      take: 60,
      include: { booking: { select: { code: true, startsAt: true } } },
    }),
    unreadCount(user.id),
  ]);

  const active = vouchers.filter((v) => v.status === 'ACTIVE');

  return (
    <>
      <TopBar title="بن‌های رزرو" subtitle="خریداری‌شده با امتیاز" unread={unread} back="/profile" />

      <div className="page-pad space-y-3 pt-2">
        {vouchers.length === 0 ? (
          <EmptyState
            icon="ticket"
            title="هنوز بنی ندارید"
            description="در بخش امتیازی فروشگاه می‌توانید با امتیازهایتان بن رزرو بخرید."
            actionHref="/market"
            actionLabel="رفتن به فروشگاه" 
          />
        ) : (
          <>
            <p className="text-[11.5px] font-semibold leading-6 text-brand-400">
              {active.length > 0
                ? `${toFaDigits(active.length)} بن قابل استفاده دارید. هنگام تأیید رزرو، بن را از فهرست انتخاب کنید.`
                : 'بن قابل استفاده‌ای ندارید.'}
            </p>

            {vouchers.map((v) => {
              const usable = v.status === 'ACTIVE';
              return (
                <div
                  key={v.id}
                  className={cn('card p-4', !usable && 'opacity-60')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-brand-800">
                        {v.kind === 'PERCENT_DISCOUNT'
                          ? `${toFaDigits(v.percentOff)}٪ تخفیف رزرو`
                          : VOUCHER_KIND_LABEL[v.kind]}
                      </p>
                      <p dir="ltr" className="num mt-1 text-[11px] font-bold text-brand-400">
                        {v.code}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-lg px-2 py-1 text-[9.5px] font-black',
                        usable
                          ? 'bg-success/15 text-success'
                          : 'bg-surface-muted text-brand-400',
                      )}
                    >
                      {VOUCHER_STATUS_LABEL[v.status]}
                    </span>
                  </div>

                  <p className="mt-2 text-[10.5px] font-semibold text-brand-300">
                    {usable ? 'معتبر تا' : 'تاریخ اعتبار'} {formatJalaliDate(v.expiresAt)}
                    {v.maxDiscountRial && (
                      <>
                        <Dot />
                        سقف {formatToman(v.maxDiscountRial)}
                      </>
                    )}
                  </p>

                  {v.booking && (
                    <p dir="ltr" className="num mt-1 text-[10.5px] font-bold text-brand-400">
                      {v.booking.code}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
