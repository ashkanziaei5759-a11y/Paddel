import type { Metadata } from 'next';
import Link from 'next/link';
import { DesignerCredit } from '@/components/ui/DesignerCredit';
import { ImageSlider } from '@/components/ui/image-slider';
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardFooter,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { LoginForm } from './LoginForm';
import { FALLBACK_SLIDE, LOGIN_SLIDES } from '@/lib/login-slides';

export const metadata: Metadata = { title: 'ورود' };

/**
 * صفحه‌ی ورود.
 *
 * پوستر باشگاه تمام صفحه را می‌گیرد و فرم روی آن مثل یک شیشه می‌نشیند.
 * روی موبایل، کارت به پایین صفحه چسبیده است: هم انگشت راحت به فیلدها می‌رسد و
 * هم دو سوم بالای پوستر (بازیکن در حال ضربه) دیده می‌ماند.
 */
export default function LoginPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-scrim">
      {/* ---- پوستر، تمام‌صفحه ---- */}
      <div className="absolute inset-0">
        <ImageSlider
          images={LOGIN_SLIDES.map((s) => s.src)}
          alts={LOGIN_SLIDES.map((s) => s.alt)}
          fallbackSrc={FALLBACK_SLIDE}
          overlay="none"
          interval={6000}
        />
      </div>

      {/* تیرگی از پایین، تا متن روی هر پوستری خوانا بماند */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim via-scrim/70 to-scrim/25 lg:bg-gradient-to-l lg:from-scrim lg:via-scrim/75 lg:to-transparent" />

      {/* تابش نورافکن — یک بار، هنگام باز شدن صفحه */}
      <div
        aria-hidden
        className="floodlight pointer-events-none absolute inset-y-0 -right-1/3 w-2/3 bg-gradient-to-l from-transparent via-electric-500/35 to-transparent blur-2xl"
      />

      <div className="relative flex min-h-dvh flex-col justify-end px-4 pb-5 safe-top safe-bottom lg:justify-center lg:px-16">
        <div className="w-full lg:max-w-[420px]">
          {/* ---- نشان برند ---- */}
          <Link href="/" className="mb-5 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/logo-256.png"
              alt=""
              width={52}
              height={52}
              className="h-[52px] w-[52px] rounded-2xl shadow-lift-electric"
            />
            <span>
              <span className="block text-[10px] font-bold tracking-[0.34em] text-electric-300">
                PERSIAN PADEL
              </span>
              <span className="mt-1 block text-lg font-black leading-tight text-white">
                باشگاه پدل حرفه‌ای
              </span>
              {/* رد توپ — تنها جایی که رنگ لیمویی پوستر برمی‌گردد */}
              <span className="mt-1.5 block h-[3px] w-16 rounded-full bg-gradient-to-l from-[#D8F24A] to-transparent" />
            </span>
          </Link>

          <GlassCard className="on-glass w-full">
            <GlassCardHeader>
              <GlassCardTitle>خوش برگشتی</GlassCardTitle>
              <GlassCardDescription>
                با نام کاربری و رمز عبور وارد حساب خود شوید.
              </GlassCardDescription>
            </GlassCardHeader>

            <GlassCardContent>
              <LoginForm />
            </GlassCardContent>

            <GlassCardFooter className="flex-col justify-center gap-1">
              <p className="text-[12.5px] font-semibold text-white/60">
                هنوز حساب نساخته‌اید؟{' '}
                <Link href="/signup" className="font-black text-accent hover:text-accent-300">
                  ثبت‌نام کنید
                </Link>
              </p>
              <DesignerCredit tone="glass" />
            </GlassCardFooter>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
