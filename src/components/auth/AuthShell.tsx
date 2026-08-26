import Link from 'next/link';

/** پوسته‌ی وسط‌چین برای صفحه‌های ثبت‌نام و تأیید کد */
export function AuthShell({
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
    <div className="relative min-h-dvh overflow-hidden bg-brand-gradient-soft">
      <div className="pointer-events-none absolute inset-0 bg-court-lines opacity-70" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-sky-light/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 py-8 safe-top safe-bottom">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-256.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-2xl shadow-lift-electric"
          />
          <span className="text-right">
            <span className="block text-lg font-black tracking-tight text-white">PERSIAN PADEL</span>
            <span className="block text-[11px] font-bold tracking-widest text-sky-light/70">
              باشگاه پدل حرفه‌ای
            </span>
          </span>
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
