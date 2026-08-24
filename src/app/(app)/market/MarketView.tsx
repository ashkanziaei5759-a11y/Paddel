'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StoreCategory } from '@prisma/client';
import { Minus, Package, Plus, Star, Wallet } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Segmented } from '@/components/ui/Segmented';
import { STORE_CATEGORY_LABEL } from '@/lib/constants';
import { toFaDigits } from '@/lib/datetime';
import { cn, formatNumber, formatToman } from '@/lib/utils';

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: StoreCategory;
  pricePoints: number | null;
  priceRial: string | null;
  stock: number;
}

type Filter = 'ALL' | StoreCategory;

export function MarketView({
  products,
  points,
  balance,
  openOrders,
}: {
  products: ProductDto[];
  points: number;
  balance: string;
  openOrders: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [active, setActive] = useState<ProductDto | null>(null);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<'POINTS' | 'WALLET'>('POINTS');
  const [loading, setLoading] = useState(false);

  const categories = [...new Set(products.map((p) => p.category))];
  const shown = filter === 'ALL' ? products : products.filter((p) => p.category === filter);

  function open(p: ProductDto) {
    setActive(p);
    setQty(1);
    setMethod(p.pricePoints != null ? 'POINTS' : 'WALLET');
  }

  const totalPoints = active?.pricePoints != null ? active.pricePoints * qty : 0;
  const totalRial = active?.priceRial ? BigInt(active.priceRial) * BigInt(qty) : 0n;
  const short =
    method === 'POINTS' ? totalPoints > points : totalRial > BigInt(balance);

  async function buy() {
    if (!active) return;
    setLoading(true);
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: active.id, quantity: qty, method }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ثبت سفارش ناموفق بود.');
        return;
      }

      toast.success('سفارش شما ثبت شد. برای تحویل به باشگاه مراجعه کنید.');
      setActive(null);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* موجودی‌ها */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
            <Star className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold text-brand-400">امتیاز شما</span>
            <span className="num block text-sm font-black text-brand-800">
              {formatNumber(points)}
            </span>
          </span>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Wallet className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold text-brand-400">کیف پول</span>
            <span className="num block truncate text-sm font-black text-brand-800">
              {formatToman(BigInt(balance), { withUnit: false })}
            </span>
          </span>
        </div>
      </div>

      {openOrders > 0 && (
        <Link href="/market/orders" className="card-interactive block bg-accent-50 p-3.5 ring-accent-100">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 shrink-0 text-accent-600" strokeWidth={2} aria-hidden="true" />
            <p className="num flex-1 text-xs font-extrabold text-accent-700">
              {toFaDigits(openOrders)} سفارش در انتظار تحویل
            </p>
            <span className="text-accent-600">‹</span>
          </div>
        </Link>
      )}

      {categories.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {(['ALL', ...categories] as Filter[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                'shrink-0 cursor-pointer rounded-2xl px-4 py-2.5 text-[11px] font-extrabold transition-all',
                filter === c
                  ? 'bg-brand-gradient text-white shadow-card'
                  : 'bg-white text-brand-500 shadow-card ring-1 ring-brand-900/[.04]',
              )}
            >
              {c === 'ALL' ? 'همه' : STORE_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => open(p)}
            disabled={p.stock === 0}
            className={cn(
              'card-interactive overflow-hidden p-0 text-right',
              p.stock === 0 && 'opacity-60',
            )}
          >
            <div className="relative aspect-square w-full bg-brand-50">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-brand-200">
                  <Package className="h-9 w-9" strokeWidth={1.4} aria-hidden="true" />
                </span>
              )}
              {p.stock === 0 && (
                <span className="absolute inset-0 grid place-items-center bg-brand-950/55 text-[11px] font-black text-white">
                  ناموجود
                </span>
              )}
              {p.stock > 0 && p.stock <= 3 && (
                <span className="num absolute right-2 top-2 rounded-lg bg-danger/90 px-2 py-1 text-[9px] font-black text-white">
                  {toFaDigits(p.stock)} عدد مانده
                </span>
              )}
            </div>

            <div className="p-3">
              <p className="truncate text-xs font-extrabold text-brand-800">{p.name}</p>
              <p className="mt-0.5 text-[10px] font-bold text-brand-300">
                {STORE_CATEGORY_LABEL[p.category]}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {p.pricePoints != null && (
                  <span className="badge-accent num">{toFaDigits(p.pricePoints)} امتیاز</span>
                )}
                {p.priceRial && (
                  <span className="badge-brand num">
                    {formatToman(BigInt(p.priceRial), { withUnit: false })}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <Sheet open={active !== null} onClose={() => setActive(null)} title={active?.name}>
        {active && (
          <div className="space-y-4">
            {active.description && (
              <p className="text-xs leading-6 text-brand-500">{active.description}</p>
            )}

            {/* روش پرداخت */}
            {active.pricePoints != null && active.priceRial && (
              <Segmented
                value={method}
                onChange={setMethod}
                options={[
                  { value: 'POINTS', label: 'با امتیاز' },
                  { value: 'WALLET', label: 'از کیف پول' },
                ]}
              />
            )}

            <div className="flex items-center justify-between rounded-2xl bg-surface-muted p-3">
              <span className="text-[11px] font-bold text-brand-400">تعداد</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white text-brand-600 shadow-card"
                  aria-label="کاهش تعداد"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                </button>
                <span className="num w-6 text-center text-sm font-black text-brand-800">
                  {toFaDigits(qty)}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(active.stock, 10, q + 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white text-brand-600 shadow-card"
                  aria-label="افزایش تعداد"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="divider" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-brand-800">مبلغ نهایی</span>
              <span className="num text-lg font-black text-brand-800">
                {method === 'POINTS'
                  ? `${toFaDigits(totalPoints)} امتیاز`
                  : formatToman(totalRial)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-brand-400">
                {method === 'POINTS' ? 'امتیاز شما' : 'موجودی کیف پول'}
              </span>
              <span className={cn('num', short ? 'text-danger' : 'text-success')}>
                {method === 'POINTS' ? formatNumber(points) : formatToman(BigInt(balance))}
              </span>
            </div>

            {short ? (
              <div className="rounded-2xl bg-danger/[.06] px-4 py-3 text-xs font-bold leading-6 text-danger">
                {method === 'POINTS'
                  ? 'امتیاز شما برای این خرید کافی نیست.'
                  : 'موجودی کیف پول شما کافی نیست.'}
              </div>
            ) : (
              <button type="button" onClick={buy} disabled={loading} className="btn-accent btn-lg w-full">
                {loading ? <Spinner /> : 'ثبت سفارش'}
              </button>
            )}

            <p className="text-center text-[10px] leading-5 text-brand-300">
              سفارش پس از ثبت، در باشگاه آماده‌ی تحویل می‌شود.
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
