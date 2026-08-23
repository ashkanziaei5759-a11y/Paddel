import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'ورود' };

export default function LoginPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-white">ورود به حساب</h1>
        <p className="mt-2 text-sm font-semibold text-sky-light/70">
          با نام کاربری و رمز عبور خود وارد شوید
        </p>
      </div>

      <div className="card p-6">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-sky-light/70">
        حساب کاربری ندارید؟{' '}
        <Link href="/signup" className="font-black text-accent hover:underline">
          ثبت‌نام کنید
        </Link>
      </p>
    </div>
  );
}
