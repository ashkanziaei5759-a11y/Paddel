'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, LogIn, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="username">نام کاربری</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          dir="ltr"
          className="text-left"
          placeholder="username"
          required
        />
      </div>

      <div>
        <Label htmlFor="password">رمز عبور</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            dir="ltr"
            className="pl-12 text-left"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 left-2 my-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-brand-300 transition-colors hover:text-brand-600 [.on-glass_&]:text-white/50 [.on-glass_&]:hover:text-white"
            aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
          >
            {showPassword ? (
              <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <Eye className="h-4.5 w-4.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-danger/[.06] px-4 py-3 text-xs font-bold leading-6 text-danger [.on-glass_&]:bg-danger/20 [.on-glass_&]:text-white"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            ورود به حساب
          </>
        )}
      </Button>
    </form>
  );
}
