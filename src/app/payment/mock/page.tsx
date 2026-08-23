import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * صفحه‌ی شبیه‌سازی درگاه پرداخت — فقط در محیط توسعه.
 * جایگزین درگاه واقعی برای تست کامل چرخه‌ی شارژ کیف پول.
 */
export default async function MockGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; amount?: string; callback?: string }>;
}) {
  if (process.env.PAYMENT_PROVIDER !== 'mock') notFound();

  const { ref, amount, callback } = await searchParams;
  if (!ref || !callback) notFound();

  const toman = Math.round(Number(amount || 0) / 10).toLocaleString('fa-IR');

  async function complete(formData: FormData) {
    'use server';
    const status = String(formData.get('status') || 'failed');
    const target = new URL(callback!);
    target.searchParams.set('ref', ref!);
    target.searchParams.set('status', status);
    redirect(target.toString());
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient-soft p-6">
      <div className="card w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-accent-50 text-2xl">
          🏦
        </div>
        <h1 className="text-lg font-black text-brand-800">درگاه پرداخت آزمایشی</h1>
        <p className="mt-2 text-xs font-semibold leading-6 text-brand-400">
          این صفحه فقط در محیط توسعه فعال است و جایگزین درگاه بانکی واقعی می‌شود.
        </p>

        <div className="my-5 rounded-2xl bg-surface-muted p-4">
          <p className="text-[11px] font-bold text-brand-400">مبلغ قابل پرداخت</p>
          <p className="num mt-1 text-2xl font-black text-brand-800">{toman} تومان</p>
          <p className="num mt-2 text-[10px] font-bold text-brand-300">{ref}</p>
        </div>

        <form action={complete} className="space-y-2">
          <button name="status" value="success" type="submit" className="btn-accent btn-lg w-full">
            پرداخت موفق
          </button>
          <button name="status" value="failed" type="submit" className="btn-outline w-full">
            انصراف / پرداخت ناموفق
          </button>
        </form>
      </div>
    </div>
  );
}
