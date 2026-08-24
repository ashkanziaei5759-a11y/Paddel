import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { STORE_ORDER_STATUS_LABEL, STORE_PAYMENT_LABEL } from '@/lib/constants';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';
import { CancelOrderButton } from './CancelOrderButton';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'سفارش‌های من' };
export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'badge-accent',
  READY: 'badge-success',
  DELIVERED: 'badge-brand',
  CANCELLED: 'badge-danger',
};

export default async function OrdersPage() {
  const user = await requirePage();

  const [orders, unread] = await Promise.all([
    prisma.storeOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: true },
    }),
    unreadCount(user.id),
  ]);

  return (
    <>
      <TopBar title="سفارش‌های من" subtitle="خریدهای فروشگاه" unread={unread} back="/market" />
      <div className="page-pad pt-2">
        {orders.length === 0 ? (
          <EmptyState
            icon="ticket"
            title="سفارشی ثبت نکرده‌اید"
            description="از فروشگاه باشگاه راکت، توپ و لوازم ورزشی تهیه کنید."
            actionLabel="رفتن به فروشگاه"
            actionHref="/market"
          />
        ) : (
          <div className="stagger space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {o.items.map((i) => i.nameSnapshot).join('، ')}
                    </p>
                    <p className="num mt-1 text-[10px] font-semibold text-brand-400">
                      {o.code}
                      <Dot />
                      {formatDateTime(o.createdAt, { withWeekday: false })}
                    </p>
                  </div>
                  <span className={cn('shrink-0', STATUS_STYLE[o.status])}>
                    {STORE_ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-brand-400">{STORE_PAYMENT_LABEL[o.method]}</span>
                  <span className="num text-brand-700">
                    {o.method === 'POINTS'
                      ? `${toFaDigits(o.totalPoints)} امتیاز`
                      : formatToman(o.totalRial)}
                  </span>
                </div>

                {(o.status === 'PENDING' || o.status === 'READY') && (
                  <CancelOrderButton orderId={o.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
