import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'ثبت‌نام' };

export default function SignupPage() {
  return (
    <AuthShell
      title="ساخت حساب کاربری"
      subtitle="به جامعه‌ی بازیکنان پرشین پدل بپیوندید"
      footer={
        <p className="mt-6 text-center text-sm font-semibold text-sky-light/70">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link href="/login" className="font-black text-accent hover:underline">
            وارد شوید
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
