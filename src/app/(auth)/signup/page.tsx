import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'ثبت‌نام' };

export default function SignupPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-white">ساخت حساب کاربری</h1>
        <p className="mt-2 text-sm font-semibold text-sky-light/70">
          به جامعه‌ی بازیکنان پرشین پدل بپیوندید
        </p>
      </div>

      <div className="card p-6">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-sky-light/70">
        قبلاً ثبت‌نام کرده‌اید؟{' '}
        <Link href="/login" className="font-black text-accent hover:underline">
          وارد شوید
        </Link>
      </p>
    </div>
  );
}
