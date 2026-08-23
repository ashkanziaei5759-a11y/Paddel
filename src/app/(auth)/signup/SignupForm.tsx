'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: String(form.get('firstName') || ''),
      lastName: String(form.get('lastName') || ''),
      username: String(form.get('username') || ''),
      password: String(form.get('password') || ''),
      phone: String(form.get('phone') || ''),
    };

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (Array.isArray(json.issues)) {
          const map: Record<string, string> = {};
          for (const issue of json.issues) map[issue.path] = issue.message;
          setFieldErrors(map);
        }
        setError(json.error || 'ثبت‌نام ناموفق بود.');
        return;
      }

      if (json.data?.devCode) {
        toast.show(`کد تأیید (حالت توسعه): ${json.data.devCode}`, 'info');
      } else {
        toast.success('کد تأیید برای شما ارسال شد.');
      }
      router.push(`/verify?id=${encodeURIComponent(json.data.verificationId)}`);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  const err = (name: string) => fieldErrors[name];

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="firstName">نام</label>
          <input
            id="firstName" name="firstName" type="text" autoComplete="given-name"
            className={`field ${err('firstName') ? 'field-error' : ''}`} placeholder="علی" required
          />
          {err('firstName') && <p className="error-text">{err('firstName')}</p>}
        </div>
        <div>
          <label className="label" htmlFor="lastName">نام خانوادگی</label>
          <input
            id="lastName" name="lastName" type="text" autoComplete="family-name"
            className={`field ${err('lastName') ? 'field-error' : ''}`} placeholder="محمدی" required
          />
          {err('lastName') && <p className="error-text">{err('lastName')}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="username">نام کاربری</label>
        <input
          id="username" name="username" type="text" autoComplete="username" dir="ltr"
          className={`field text-left ${err('username') ? 'field-error' : ''}`}
          placeholder="ali_padel" required
        />
        <p className="helper">حروف انگلیسی، عدد، نقطه و زیرخط — بین ۳ تا ۲۴ کاراکتر</p>
        {err('username') && <p className="error-text">{err('username')}</p>}
      </div>

      <div>
        <label className="label" htmlFor="password">رمز عبور</label>
        <input
          id="password" name="password" type="password" autoComplete="new-password" dir="ltr"
          className={`field text-left ${err('password') ? 'field-error' : ''}`}
          placeholder="••••••••" required
        />
        <p className="helper">حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد</p>
        {err('password') && <p className="error-text">{err('password')}</p>}
      </div>

      <div>
        <label className="label" htmlFor="phone">شماره موبایل</label>
        <input
          id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr"
          className={`field text-left ${err('phone') ? 'field-error' : ''}`}
          placeholder="09121234567" required
        />
        <p className="helper">کد تأیید به این شماره پیامک می‌شود و پس از تأیید ثابت خواهد بود.</p>
        {err('phone') && <p className="error-text">{err('phone')}</p>}
      </div>

      {error && (
        <div className="rounded-2xl bg-danger/[.06] px-4 py-3 text-xs font-bold leading-6 text-danger">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
        {loading ? <Spinner /> : 'دریافت کد تأیید'}
      </button>
    </form>
  );
}
