import type { Metadata } from 'next';
import Link from 'next/link';
import { ImageSlider } from '@/components/ui/image-slider';
import { LoginForm } from './LoginForm';
import { FALLBACK_SLIDE, HAS_OWN_ARTWORK, LOGIN_SLIDES } from '@/lib/login-slides';

export const metadata: Metadata = { title: 'ورود' };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[1.05fr_1fr]">
      {/* ---- پوستر باشگاه (فقط دسکتاپ) ---- */}
      <div className="relative hidden overflow-hidden bg-scrim lg:block">
        <ImageSlider
          images={LOGIN_SLIDES.map((s) => s.src)}
          alts={LOGIN_SLIDES.map((s) => s.alt)}
          fallbackSrc={FALLBACK_SLIDE}
          overlay={HAS_OWN_ARTWORK ? 'none' : 'strong'}
          interval={5000}
        />

        {/* متن فقط وقتی نوشته می‌شود که تصویر خودش تایپوگرافی نداشته باشد */}
        {!HAS_OWN_ARTWORK && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-10">
            <p className="text-[11px] font-bold tracking-[0.3em] text-accent">PERSIAN PADEL</p>
            <h2 className="mt-3 max-w-sm text-3xl font-black leading-[1.35] text-white text-balance">
              زمین رزرو کن، تیم بساز، قهرمان شو.
            </h2>
          </div>
        )}
      </div>

      {/* ---- فرم ورود ---- */}
      <div className="relative flex items-center justify-center overflow-hidden bg-sky-gradient px-5 py-10 sm:px-10">
        {/* روی موبایل، پوستر پس‌زمینه‌ی محو فرم می‌شود */}
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <ImageSlider
            images={LOGIN_SLIDES.map((s) => s.src)}
            alts={LOGIN_SLIDES.map((s) => s.alt)}
            fallbackSrc={FALLBACK_SLIDE}
            overlay="none"
            interval={5000}
            className="opacity-100"
          />
          <div className="absolute inset-0 bg-scrim/85 backdrop-blur-[3px]" />
        </div>

        {/* بافت ظریف خطوط زمین در پس‌زمینه‌ی فرم */}
        <div className="pointer-events-none absolute inset-0 hidden bg-court-lines opacity-[0.35] lg:block" />
        <div className="pointer-events-none absolute -left-24 top-1/4 hidden h-72 w-72 rounded-full bg-accent/10 blur-3xl lg:block" />

        <div className="relative w-full max-w-sm">
          {/* نشان برند */}
          <Link href="/" className="mb-8 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/logo-256.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-2xl shadow-lift-electric"
            />
            <span>
              <span className="block text-base font-black tracking-tight text-white lg:text-brand-800">
                PERSIAN PADEL
              </span>
              <span className="block text-[10px] font-bold tracking-widest text-sky-light/70 lg:text-brand-400">
                باشگاه پدل حرفه‌ای
              </span>
            </span>
          </Link>

          <div className="rounded-4xl bg-card p-7 shadow-premium lg:bg-white/70 lg:backdrop-blur-xl">
            <div className="mb-7">
              <h1 className="text-2xl font-black text-brand-800">خوش برگشتی</h1>
              <p className="mt-2 text-sm font-semibold leading-7 text-brand-400">
                با نام کاربری و رمز عبور وارد حساب خود شوید.
              </p>
            </div>

            <LoginForm />

            <p className="mt-7 text-center text-sm font-semibold text-brand-400">
              هنوز حساب نساخته‌اید؟{' '}
              <Link href="/signup" className="font-black text-brand-700 hover:text-accent-500">
                ثبت‌نام کنید
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
