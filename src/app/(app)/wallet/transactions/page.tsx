import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { formatToman } from '@/lib/utils';
import { formatDateTime } from '@/lib/datetime';
import { WALLET_TX_LABEL } from '@/lib/constants';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'تراکنش‌های کیف پول' };
export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  const user = await requirePage();

  const [transactions, unread] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    unreadCount(user.id),
  ]);

  return (
    <>
      <TopBar title="تراکنش‌های کیف پول" subtitle="سوابق مالی شما" unread={unread} back="/wallet" />

      <div className="page-pad pt-2">
        {transactions.length === 0 ? (
          <EmptyState icon="receipt" title="تراکنشی ثبت نشده است" />
        ) : (
          <div className="card divide-y divide-brand-50 overflow-hidden">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black',
                      tx.amount > 0n ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-500',
                    )}
                  >
                    {tx.amount > 0n ? '↓' : '↑'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {tx.description || WALLET_TX_LABEL[tx.type]}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-brand-300">
                      {formatDateTime(tx.createdAt, { withWeekday: false })}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p
                      className={cn(
                        'num text-xs font-black',
                        tx.amount > 0n ? 'text-success' : 'text-brand-700',
                      )}
                    >
                      {tx.amount > 0n ? '+' : '−'}
                      {formatToman(tx.amount < 0n ? -tx.amount : tx.amount, { withUnit: false })}
                    </p>
                    <p className="num mt-0.5 text-[9px] font-bold text-brand-300">
                      مانده {formatToman(tx.balanceAfter, { withUnit: false })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
