'use client';

import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

/**
 * دکمه‌ی تلاش دوباره.
 *
 * وضعیت واقعی شبکه را هم نشان می‌دهد: تا وقتی مرورگر می‌گوید آفلاین‌ایم،
 * زدن دکمه فقط همین صفحه را دوباره می‌آورد، پس بهتر است کاربر بداند.
 */
export function OfflineRetry() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-accent-gradient
                   px-6 text-sm font-black text-on-accent shadow-card transition
                   active:scale-[.97]"
      >
        <RotateCw className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
        تلاش دوباره
      </button>

      <p className="text-[11px] font-bold text-sky-light/60" role="status">
        {online ? 'اینترنت وصل شد — دوباره تلاش کنید.' : 'هنوز آفلاین هستید.'}
      </p>
    </div>
  );
}
