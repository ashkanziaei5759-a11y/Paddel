import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { getWallet } from '@/lib/wallet';
import { formatToman } from '@/lib/utils';
import { formatDateTime } from '@/lib/datetime';
import { WALLET_TX_LABEL } from '@/lib/constants';
import { TopupPanel } from './TopupPanel';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = { title: 'کیف پول' };
export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const user = await requirePage();

  const [wallet, transactions, unread] = await Promise.all([
    getWallet(user.id),
    prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    unreadCount(user.id),
  ]);

  return (
    <>
      <TopBar title="کیف پول" subtitle="موجودی و تراکنش‌ها" unread={unread} />

      <div className="page-pad stagger space-y-4 pt-2">
        {/* کارت موجودی */}
        <section className="card-dark p-6">
          <div className="relative">
            <p className="text-[11px] font-bold tracking-widest text-sky-light/60">موجودی کیف پول</p>
            <p className="num mt-2 text-4xl font-black tracking-tight text-white">
              {formatToman(wallet.balance, { withUnit: false })}
              <span className="mr-2 text-sm font-bold text-sky-light/60">تومان</span>
            </p>
            <div className="mt-5 flex items-center gap-2 text-[11px] font-bold text-sky-light/60">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">💳</span>
              <span>{user.fullName}</span>
            </div>
          </div>
        </section>

        <TopupPanel />

        {/* تراکنش‌های اخیر */}
        <section>
          <div className="section-title mb-3">
            <h2>تراکنش‌های اخیر</h2>
            <Link
              href="/wallet/transactions"
              className="link-more"
            >
              مشاهده همه
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="text-xs font-bold text-brand-300">هنوز تراکنشی ثبت نشده است.</p>
            </div>
          ) : (
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm',
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
                  <span
                    className={cn(
                      'num shrink-0 text-xs font-black',
                      tx.amount > 0n ? 'text-success' : 'text-brand-700',
                    )}
                  >
                    {tx.amount > 0n ? '+' : '−'}
                    {formatToman(tx.amount < 0n ? -tx.amount : tx.amount, { withUnit: false })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
