'use client';

import { useEffect } from 'react';

/** ثبت Service Worker برای قابلیت نصب و کارکرد آفلاین */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error) => console.warn('[pwa] ثبت Service Worker ناموفق بود:', error));
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
