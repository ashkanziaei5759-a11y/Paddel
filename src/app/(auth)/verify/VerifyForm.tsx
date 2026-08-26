'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { toFaDigits } from '@/lib/datetime';

const CODE_LENGTH = 5;

export function VerifyForm({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [id, setId] = useState(verificationId);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/[^\d]/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData('text').replace(/[^\d]/g, '').slice(0, CODE_LENGTH);
    if (!text) return;
    const next = Array(CODE_LENGTH).fill('');
    text.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    inputs.current[Math.min(text.length, CODE_LENGTH - 1)]?.focus();
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      setError('کد تأیید را کامل وارد کنید.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId: id, code }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || 'تأیید ناموفق بود.');
        setDigits(Array(CODE_LENGTH).fill(''));
        inputs.current[0]?.focus();
        return;
      }

      toast.success('شماره موبایل شما تأیید شد. خوش آمدید!');
      router.replace('/home');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId: id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'ارسال مجدد ناموفق بود.');
        return;
      }
      setId(json.data.verificationId);
      setSecondsLeft(120);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
      if (json.data?.devCode) toast.show(`کد جدید (حالت توسعه): ${json.data.devCode}`, 'info');
      else toast.success('کد جدید ارسال شد.');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setResending(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div dir="ltr" className="flex justify-center gap-2.5">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputs.current[index] = el; }}
            value={digit}
            onChange={(e) => setDigit(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            onPaste={onPaste}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label={`رقم ${index + 1} کد تأیید`}
            className={`num h-14 w-12 rounded-2xl border bg-surface-muted text-center text-xl font-black text-brand-800 transition-all
              focus:border-accent focus:bg-card focus:outline-none focus:ring-4 focus:ring-accent/15
              ${error ? 'border-danger/40' : 'border-brand-100'}`}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-danger/[.06] px-4 py-3 text-center text-xs font-bold leading-6 text-danger">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-accent btn-lg w-full">
        {loading ? <Spinner /> : 'تأیید و ورود'}
      </button>

      <div className="text-center">
        {secondsLeft > 0 ? (
          <p className="num text-xs font-bold text-brand-400">
            ارسال مجدد کد تا {toFaDigits(`${mm}:${ss}`)}
          </p>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="text-xs font-black text-brand-600 hover:text-accent-500"
          >
            {resending ? 'در حال ارسال…' : 'ارسال مجدد کد تأیید'}
          </button>
        )}
      </div>
    </form>
  );
}
