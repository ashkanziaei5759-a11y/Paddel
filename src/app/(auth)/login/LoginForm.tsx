'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: String(form.get('username') || ''),
          password: String(form.get('password') || ''),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || 'ورود ناموفق بود.');
        return;
      }

      toast.success('خوش آمدید!');
      router.replace(json.data?.role === 'ADMIN' ? '/admin' : '/home');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="username">
          نام کاربری
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          dir="ltr"
          className="field text-left"
          placeholder="username"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          رمز عبور
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            dir="ltr"
            className="field pl-12 text-left"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 left-2 my-auto flex h-8 w-8 items-center justify-center rounded-xl text-brand-300 transition hover:text-brand-500"
            aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-danger/[.06] px-4 py-3 text-xs font-bold leading-6 text-danger">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
        {loading ? <Spinner /> : 'ورود'}
      </button>
    </form>
  );
}
