import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect('/home');

  return (
    <div className="relative min-h-dvh overflow-hidden bg-brand-gradient-soft">
      {/* پس‌زمینه‌ی خطوط زمین پدل */}
      <div className="pointer-events-none absolute inset-0 bg-court-lines opacity-70" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-sky-light/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 py-8 safe-top safe-bottom">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-gradient text-2xl shadow-glow">
            🎾
          </span>
          <span className="text-right">
            <span className="block text-lg font-black tracking-tight text-white">PERSIAN PADEL</span>
            <span className="block text-[11px] font-bold tracking-widest text-sky-light/70">
              باشگاه پدل حرفه‌ای
            </span>
          </span>
        </Link>

        <div className="flex flex-1 flex-col justify-center">{children}</div>

        <p className="mt-8 text-center text-[11px] font-semibold text-sky-light/50">
          © پرشین پدل — تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  );
}
