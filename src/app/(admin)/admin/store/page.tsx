import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StoreManager, type ProductRow, type OrderRow } from './StoreManager';
import { rialToToman } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

export const metadata: Metadata = { title: 'مدیریت فروشگاه' };
export const dynamic = 'force-dynamic';

export default async function AdminStorePage() {
  const [products, orders] = await Promise.all([
    prisma.storeProduct.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.storeOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { items: true, user: { include: { profile: true } } },
    }),
  ]);

  const productRows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    category: p.category,
    pricePoints: p.pricePoints,
    priceToman: p.priceRial ? rialToToman(p.priceRial) : null,
    stock: p.stock,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  }));

  const orderRows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    method: o.method,
    totalPoints: o.totalPoints,
    totalRial: o.totalRial.toString(),
    createdAt: o.createdAt.toISOString(),
    userName: `${o.user.profile?.firstName ?? ''} ${o.user.profile?.lastName ?? ''}`.trim(),
    userId: o.userId,
    items: o.items.map((i) => `${i.nameSnapshot} × ${i.quantity}`),
  }));

  const pending = orders.filter((o) => o.status === 'PENDING' || o.status === 'READY').length;

  return (
    <>
      <AdminHeader
        title="فروشگاه باشگاه"
        subtitle={`${toFaDigits(products.length)} کالا · ${toFaDigits(pending)} سفارش در انتظار`}
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <StoreManager products={productRows} orders={orderRows} />
      </div>
    </>
  );
}
