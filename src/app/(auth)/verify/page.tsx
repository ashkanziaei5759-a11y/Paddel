import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerifyForm } from './VerifyForm';

export const metadata: Metadata = { title: 'تأیید شماره موبایل' };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect('/signup');

  return (
    <div className="animate-fade-up">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-3xl backdrop-blur-xl">
          📱
        </div>
        <h1 className="text-2xl font-black text-white">تأیید شماره موبایل</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-sky-light/70">
          کد تأیید ارسال‌شده را وارد کنید
        </p>
      </div>

      <div className="card p-6">
        <VerifyForm verificationId={id} />
      </div>
    </div>
  );
}
