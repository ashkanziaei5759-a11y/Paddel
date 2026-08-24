import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CancellationPolicyEditor } from './CancellationPolicyEditor';
import { DEFAULT_CANCELLATION_POLICIES } from '@/lib/constants';
import { availableGateways } from '@/lib/payments';
import { availableSmsProviders } from '@/lib/sms';
import { APP_TIMEZONE } from '@/lib/datetime';

export const metadata: Metadata = { title: 'تنظیمات باشگاه' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const stored = await prisma.cancellationPolicy.findMany({
    orderBy: { minMinutesBefore: 'desc' },
  });

  const policies = stored.length
    ? stored.map((p) => ({
        name: p.name,
        minMinutesBefore: p.minMinutesBefore,
        maxMinutesBefore: p.maxMinutesBefore,
        penaltyPercent: p.penaltyPercent,
        isActive: p.isActive,
      }))
    : DEFAULT_CANCELLATION_POLICIES.map((p) => ({
        name: p.name,
        minMinutesBefore: p.minMinutesBefore,
        maxMinutesBefore: p.maxMinutesBefore,
        penaltyPercent: p.penaltyPercent,
        isActive: true,
      }));

  const activeGateway = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  const activeSms = (process.env.OTP_PROVIDER || 'console').toLowerCase();

  return (
    <>
      <AdminHeader title="تنظیمات باشگاه" subtitle="قوانین لغو و پیکربندی سرویس‌ها" />

      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:px-8">
        <CancellationPolicyEditor initial={policies} />

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-sm font-extrabold text-brand-800">پیکربندی سرویس‌ها</h2>
            <p className="mt-1 text-[11px] leading-6 text-brand-400">
              این مقادیر از متغیرهای محیطی سرور خوانده می‌شوند و از داخل پنل قابل تغییر نیستند؛
              برای تغییر، متغیر محیطی را روی سرور به‌روزرسانی و سرویس را دوباره راه‌اندازی کنید.
            </p>
          </div>

          <ConfigRow
            label="درگاه پرداخت فعال"
            value={availableGateways().find((g) => g.id === activeGateway)?.title ?? activeGateway}
            env="PAYMENT_PROVIDER"
            warn={activeGateway === 'mock'}
            warnText="درگاه آزمایشی فعال است — پیش از راه‌اندازی واقعی حتماً یک درگاه معتبر تنظیم کنید."
          />

          <ConfigRow
            label="سرویس پیامک فعال"
            value={availableSmsProviders().find((s) => s.id === activeSms)?.title ?? activeSms}
            env="OTP_PROVIDER"
            warn={activeSms === 'console'}
            warnText="کد تأیید فقط در کنسول سرور چاپ می‌شود و پیامکی ارسال نمی‌گردد."
          />

          <ConfigRow label="منطقه‌ی زمانی باشگاه" value={APP_TIMEZONE} env="APP_TIMEZONE" />

          <ConfigRow
            label="نشانی عمومی اپلیکیشن"
            value={process.env.NEXT_PUBLIC_APP_URL || '—'}
            env="NEXT_PUBLIC_APP_URL"
            warn={!process.env.NEXT_PUBLIC_APP_URL}
            warnText="بدون این مقدار، بازگشت از درگاه پرداخت درست کار نمی‌کند."
          />

          <ConfigRow
            label="اعتبار کد تأیید"
            value={`${process.env.OTP_TTL_SECONDS || '120'} ثانیه`}
            env="OTP_TTL_SECONDS"
          />
        </section>
      </div>
    </>
  );
}

function ConfigRow({
  label,
  value,
  env,
  warn,
  warnText,
}: {
  label: string;
  value: string;
  env: string;
  warn?: boolean;
  warnText?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-muted p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold text-brand-400">{label}</span>
        <span className="text-xs font-extrabold text-brand-800">{value}</span>
      </div>
      <p className="num mt-1.5 text-[10px] font-bold text-brand-300" dir="ltr">
        {env}
      </p>
      {warn && warnText && (
        <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-[10px] font-bold leading-5 text-warning">
          ⚠️ {warnText}
        </p>
      )}
    </div>
  );
}
