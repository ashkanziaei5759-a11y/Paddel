import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { getWallet } from '@/lib/wallet';
import { MarketView, type ProductDto } from './MarketView';

export const metadata: Metadata = { title: 'فروشگاه' };
export const dynamic = 'force-dynamic';

export default async function MarketPage() {
  const user = await requirePage();

  const [products, wallet, unread, openOrders] = await Promise.all([
    prisma.storeProduct.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    getWallet(user.id),
    unreadCount(user.id),
    prisma.storeOrder.count({ where: { userId: user.id, status: { in: ['PENDING', 'READY'] } } }),
  ]);

  const dto: ProductDto[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    category: p.category,
    pricePoints: p.pricePoints,
    priceRial: p.priceRial ? p.priceRial.toString() : null,
    stock: p.stock,
  }));

  return (
    <>
      <TopBar title="فروشگاه باشگاه" subtitle="خرید با امتیاز یا کیف پول" unread={unread} />
      <div className="page-pad pt-2">
        {dto.length === 0 ? (
          <EmptyState
            icon="ticket"
            title="فروشگاه هنوز خالی است"
            description="به‌زودی راکت، توپ و لوازم باشگاه اینجا اضافه می‌شوند."
          />
        ) : (
          <MarketView
            products={dto}
            points={user.points}
            balance={wallet.balance.toString()}
            openOrders={openOrders}
          />
        )}
      </div>
    </>
  );
}
