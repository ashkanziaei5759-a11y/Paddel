'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted p-6 text-center">
      <span className="text-5xl">⚠️</span>
      <h1 className="text-xl font-black text-brand-800">خطایی رخ داد</h1>
      <p className="max-w-xs text-sm font-semibold leading-6 text-brand-400">
        متأسفانه مشکلی در نمایش این صفحه پیش آمد. لطفاً دوباره تلاش کنید.
      </p>
      <button type="button" onClick={reset} className="btn-primary btn-lg mt-2">
        تلاش دوباره
      </button>
    </div>
  );
}
