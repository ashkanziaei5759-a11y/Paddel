'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatRelative, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

interface StaffDto {
  id: string;
  username: string;
  phone: string | null;
  name: string;
  active: boolean;
  lastLoginAt: string | null;
  bookings: number;
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || 'انجام نشد.');
  return json.data;
}

/**
 * ساخت و مدیریت حساب‌های ادمین پذیرش.
 * این ادمین‌ها فقط می‌توانند برای بازیکن رزرو تلفنی ثبت کنند و رزروها را ببینند.
 */
export function StaffManager({ staff }: { staff: StaffDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<StaffDto | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await send('/api/admin/staff', 'POST', {
        firstName: String(form.get('firstName') ?? ''),
        lastName: String(form.get('lastName') ?? ''),
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
        phone: String(form.get('phone') ?? ''),
      });
      toast.success('حساب ادمین ساخته شد. نام کاربری و رمز را به او بدهید.');
      setCreating(false);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: StaffDto) {
    setBusy(true);
    try {
      await send(`/api/admin/staff/${s.id}`, 'PATCH', { status: s.active ? 'SUSPENDED' : 'ACTIVE' });
      toast.success(s.active ? 'حساب غیرفعال شد و از همه‌ی دستگاه‌ها خارج شد.' : 'حساب دوباره فعال شد.');
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetFor) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await send(`/api/admin/staff/${resetFor.id}`, 'PATCH', { password: String(form.get('password') ?? '') });
      toast.success('رمز تازه ثبت شد.');
      setResetFor(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <p className="flex-1 text-[11.5px] font-semibold leading-6 text-brand-500">
          ادمین پذیرش با موبایل یا کامپیوتر وارد می‌شود و فقط می‌تواند برای بازیکنی که تماس گرفته
          زمین رزرو کند (مبلغ از کیف پول بازیکن کم می‌شود) و فهرست رزروها را ببیند. به تنظیمات، مالی
          و بقیه‌ی پنل دسترسی ندارد.
        </p>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary btn-sm shrink-0">
          <UserPlus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          ادمین جدید
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-xs font-bold text-brand-300">هنوز ادمین پذیرشی نساخته‌اید.</p>
        </div>
      ) : (
        <div className="card divide-y divide-brand-50 overflow-hidden">
          {staff.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-extrabold text-brand-800">
                  {s.name}
                  <span className={cn(s.active ? 'badge-success' : 'badge-danger')}>
                    {s.active ? 'فعال' : 'غیرفعال'}
                  </span>
                </p>
                <p className="num mt-0.5 text-[10.5px] font-semibold text-brand-400" dir="ltr">
                  @{s.username}
                  {s.phone ? ` · ${s.phone}` : ''}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-brand-300">
                  {toFaDigits(s.bookings)} رزرو ثبت کرده ·{' '}
                  {s.lastLoginAt ? `آخرین ورود ${formatRelative(new Date(s.lastLoginAt))}` : 'هنوز وارد نشده'}
                </p>
              </div>
              <button type="button" onClick={() => setResetFor(s)} className="btn-outline btn-sm">
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                رمز تازه
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(s)}
                className={cn('btn-sm', s.active ? 'btn-danger' : 'btn-accent')}
              >
                {s.active ? 'غیرفعال کن' : 'فعال کن'}
              </button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="ساخت ادمین پذیرش">
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="st-fn">نام</label>
              <input id="st-fn" name="firstName" required className="field" />
            </div>
            <div>
              <label className="label" htmlFor="st-ln">نام خانوادگی</label>
              <input id="st-ln" name="lastName" required className="field" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="st-un">نام کاربری (انگلیسی)</label>
            <input id="st-un" name="username" required dir="ltr" autoComplete="off" className="field text-left" />
          </div>
          <div>
            <label className="label" htmlFor="st-pw">رمز عبور</label>
            <input id="st-pw" name="password" required dir="ltr" autoComplete="new-password" className="field text-left" />
            <p className="helper">حداقل ۸ کاراکتر، شامل حرف و عدد.</p>
          </div>
          <div>
            <label className="label" htmlFor="st-ph">موبایل (اختیاری)</label>
            <input id="st-ph" name="phone" inputMode="tel" dir="ltr" className="field num text-left" placeholder="09…" />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner /> : 'ساخت حساب'}
          </button>
        </form>
      </Sheet>

      <Sheet open={resetFor !== null} onClose={() => setResetFor(null)} title={`رمز تازه برای ${resetFor?.name ?? ''}`}>
        <form onSubmit={resetPassword} className="space-y-3">
          <div>
            <label className="label" htmlFor="st-np">رمز جدید</label>
            <input id="st-np" name="password" required dir="ltr" autoComplete="new-password" className="field text-left" />
            <p className="helper">بعد از ثبت، از همه‌ی دستگاه‌ها خارج می‌شود و باید با رمز تازه وارد شود.</p>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner /> : 'ثبت رمز'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
