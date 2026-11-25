import Link from 'next/link';
import { BrandLogo } from '@/components/branding/BrandLogo';

/** پوسته‌ی وسط‌چین برای صفحه‌های ثبت‌نام و تأیید کد */
export async function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    /* پس‌زمینه‌ی سرمه‌ای یکدست برند — بدون خطوط و لکه‌های نور */
    <div className="relative min-h-dvh overflow-hidden bg-[#1C2D7D]">

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 py-8 safe-top safe-bottom">
        <Link href="/" className="mb-8 flex flex-col items-center gap-2" aria-label="Persian Padel">
          {/* لوگوی کامل برند (نسخه‌ی سفید روی سرمه‌ای) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.png" alt="Persian Padel" width={220} height={67} className="h-auto w-[220px]" />
          <span className="text-[11px] font-bold tracking-widest text-sky-light/70">باشگاه پدل حرفه‌ای</span>
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <div className="animate-fade-up">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black text-white">{title}</h1>
              <p className="mt-2 text-sm font-semibold leading-7 text-sky-light/70">{subtitle}</p>
            </div>
            <div className="card p-6">{children}</div>
            {footer}
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] font-semibold text-sky-light/50">
          © پرشین پدل — تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  );
}
