'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!confirm('این سفارش لغو شود؟ مبلغ یا امتیاز پرداختی بازگردانده می‌شود.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/store/orders/${orderId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'لغو سفارش ناموفق بود.');
        return;
      }
      toast.success('سفارش لغو و مبلغ بازگردانده شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={cancel} disabled={loading} className="btn-outline btn-sm mt-3 w-full">
      {loading ? <Spinner /> : 'لغو سفارش'}
    </button>
  );
}
