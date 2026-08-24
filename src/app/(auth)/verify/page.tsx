import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
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
    <AuthShell title="تأیید شماره موبایل" subtitle="کد تأیید ارسال‌شده را وارد کنید">
      <VerifyForm verificationId={id} />
    </AuthShell>
  );
}
