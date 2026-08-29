'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StoreCategory, StoreOrderStatus, StorePaymentMethod } from '@prisma/client';
import { Package, Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { ImagePicker } from '@/components/media/ImagePicker';
import { Spinner } from '@/components/ui/Spinner';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { Dot } from '@/components/ui/Dot';
import {
  STORE_CATEGORY_LABEL,
  STORE_ORDER_STATUS_LABEL,
  STORE_PAYMENT_LABEL,
} from '@/lib/constants';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { cn, formatToman } from '@/lib/utils';

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: StoreCategory;
  pricePoints: number | null;
  priceToman: number | null;
  stock: number;
  isActive: boolean;
  sortOrder: number;
}

export interface OrderRow {
  id: string;
  code: string;
  status: StoreOrderStatus;
  method: StorePaymentMethod;
  totalPoints: number;
  totalRial: string;
  createdAt: string;
  userName: string;
  userId: string;
  items: string[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'badge-accent',
  READY: 'badge-success',
  DELIVERED: 'badge-brand',
  CANCELLED: 'badge-danger',
};

export function StoreManager({
  products,
  orders,
}: {
  products: ProductRow[];
  orders: OrderRow[];
}) {
  const [tab, setTab] = useState<'products' | 'orders'>('products');

  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'products', label: 'کالاها', count: products.length },
          {
            value: 'orders',
            label: 'سفارش‌ها',
            count: orders.filter((o) => o.status === 'PENDING' || o.status === 'READY').length,
          },
        ]}
      />
      {tab === 'products' ? <Products rows={products} /> : <Orders rows={orders} />}
    </div>
  );
}

function Products({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [active, setActive] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openNew() {
    setEditing(null);
    setActive(true);
    setProductImage(null);
    setOpen(true);
  }
  function openEdit(p: ProductRow) {
    setEditing(p);
    setActive(p.isActive);
    setProductImage(p.imageUrl ?? null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const f = new FormData(event.currentTarget);
    const payload = {
      name: String(f.get('name') || ''),
      description: String(f.get('description') || '') || null,
      imageUrl: String(f.get('imageUrl') || '') || null,
      category: String(f.get('category') || 'ACCESSORY'),
      pricePoints: Number(f.get('pricePoints') || 0) || null,
      priceToman: Number(f.get('priceToman') || 0) || null,
      stock: Number(f.get('stock') || 0),
      isActive: active,
      sortOrder: Number(f.get('sortOrder') || 0),
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/store/products/${editing.id}` : '/api/admin/store/products',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ذخیره ناموفق بود.');
        return;
      }
      toast.success(editing ? 'کالا به‌روزرسانی شد.' : 'کالا اضافه شد.');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('این کالا حذف شود؟ اگر فروش داشته باشد فقط غیرفعال می‌شود.')) return;
    try {
      const res = await fetch(`/api/admin/store/products/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'حذف ناموفق بود.');
        return;
      }
      toast.success(json.data.deactivated ? 'کالا غیرفعال شد (سابقه‌ی فروش دارد).' : 'کالا حذف شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={openNew} className="btn-accent btn-sm">
          <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          کالای جدید
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-xs font-bold text-brand-300">هنوز کالایی اضافه نشده است.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className={cn('card p-4', !p.isActive && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-brand-200">
                      <Package className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-brand-800">{p.name}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-brand-300">
                    {STORE_CATEGORY_LABEL[p.category]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.pricePoints && (
                      <span className="badge-accent num">{toFaDigits(p.pricePoints)} امتیاز</span>
                    )}
                    {p.priceToman && (
                      <span className="badge-brand num">
                        {toFaDigits(p.priceToman.toLocaleString('en-US'))}
                      </span>
                    )}
                    <span className={cn('num', p.stock > 0 ? 'badge-muted' : 'badge-danger')}>
                      موجودی {toFaDigits(p.stock)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => openEdit(p)} className="btn-outline btn-sm flex-1">
                  ویرایش
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="btn-sm cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'ویرایش کالا' : 'کالای جدید'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label" htmlFor="p-name">نام کالا</label>
            <input id="p-name" name="name" defaultValue={editing?.name ?? ''} className="field"
              placeholder="راکت پدل حرفه‌ای" required />
          </div>
          <div>
            <label className="label" htmlFor="p-cat">دسته‌بندی</label>
            <select id="p-cat" name="category" defaultValue={editing?.category ?? 'ACCESSORY'} className="field">
              {Object.entries(STORE_CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-desc">توضیح</label>
            <textarea id="p-desc" name="description" defaultValue={editing?.description ?? ''}
              rows={2} className="field resize-none" />
          </div>
          <div>
            <span className="label">تصویر کالا</span>
            <input type="hidden" name="imageUrl" value={productImage ?? ''} readOnly />
            <ImagePicker kind="PRODUCT" value={productImage} onChange={setProductImage} label="انتخاب از گالری" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="p-points">قیمت به امتیاز</label>
              <input id="p-points" name="pricePoints" type="number" dir="ltr"
                className="field num text-left" defaultValue={editing?.pricePoints ?? ''} min={0} placeholder="۰ = ندارد" />
            </div>
            <div>
              <label className="label" htmlFor="p-toman">قیمت (تومان)</label>
              <input id="p-toman" name="priceToman" type="number" dir="ltr"
                className="field num text-left" defaultValue={editing?.priceToman ?? ''} min={0} placeholder="۰ = ندارد" />
            </div>
          </div>
          <p className="helper -mt-1">
            حداقل یکی از دو قیمت را پر کنید. اگر هر دو پر باشند، بازیکن روش پرداخت را انتخاب می‌کند.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="p-stock">موجودی</label>
              <input id="p-stock" name="stock" type="number" dir="ltr"
                className="field num text-left" defaultValue={editing?.stock ?? 0} min={0} />
            </div>
            <div>
              <label className="label" htmlFor="p-order">ترتیب نمایش</label>
              <input id="p-order" name="sortOrder" type="number" dir="ltr"
                className="field num text-left" defaultValue={editing?.sortOrder ?? 0} min={0} />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-brand-700" />
            <span className="text-xs font-bold text-brand-600">در فروشگاه نمایش داده شود</span>
          </label>

          <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
            {loading ? <Spinner /> : editing ? 'ذخیره تغییرات' : 'افزودن کالا'}
          </button>
        </form>
      </Sheet>
    </>
  );
}

function Orders({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: StoreOrderStatus) {
    if (status === 'CANCELLED' && !confirm('سفارش لغو و مبلغ/امتیاز بازگردانده شود؟')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/store/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'به‌روزرسانی ناموفق بود.');
        return;
      }
      toast.success('وضعیت سفارش به‌روزرسانی شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="text-xs font-bold text-brand-300">سفارشی ثبت نشده است.</p>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-brand-50 overflow-hidden">
      {rows.map((o) => (
        <div key={o.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/users/${o.userId}`}
                className="truncate text-xs font-extrabold text-brand-800 hover:text-accent-600"
              >
                {o.userName}
              </Link>
              <p className="mt-1 truncate text-[11px] font-semibold text-brand-500">
                {o.items.join('، ')}
              </p>
              <p className="num mt-1 text-[10px] font-bold text-brand-300">
                {o.code}
                <Dot />
                {formatDateTime(new Date(o.createdAt), { withWeekday: false })}
                <Dot />
                {STORE_PAYMENT_LABEL[o.method]}
              </p>
            </div>
            <div className="shrink-0 text-left">
              <p className="num text-xs font-black text-brand-700">
                {o.method === 'POINTS'
                  ? `${toFaDigits(o.totalPoints)} امتیاز`
                  : formatToman(BigInt(o.totalRial), { withUnit: false })}
              </p>
              <span className={cn('mt-1 inline-block', STATUS_STYLE[o.status])}>
                {STORE_ORDER_STATUS_LABEL[o.status]}
              </span>
            </div>
          </div>

          {(o.status === 'PENDING' || o.status === 'READY') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {o.status === 'PENDING' && (
                <button type="button" disabled={busy === o.id}
                  onClick={() => setStatus(o.id, 'READY')} className="btn-outline btn-sm">
                  {busy === o.id ? <Spinner /> : 'آماده‌ی تحویل'}
                </button>
              )}
              <button type="button" disabled={busy === o.id}
                onClick={() => setStatus(o.id, 'DELIVERED')} className="btn-accent btn-sm">
                تحویل داده شد
              </button>
              <button type="button" disabled={busy === o.id}
                onClick={() => setStatus(o.id, 'CANCELLED')}
                className="btn-sm cursor-pointer rounded-xl px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10">
                لغو و بازگشت وجه
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
