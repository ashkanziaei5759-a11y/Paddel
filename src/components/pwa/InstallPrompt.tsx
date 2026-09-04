'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pp_install_dismissed_at';
const DISMISS_DAYS = 14;

/**
 * پیشنهاد نصب روی صفحه‌ی اصلی.
 * اندروید/دسکتاپ: رویداد استاندارد beforeinstallprompt.
 * iOS: راهنمای دستی «افزودن به صفحه اصلی» چون Safari این رویداد را ندارد.
 */
export function InstallPrompt({ logoUrl }: { logoUrl: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);

    if (ios && isSafari) {
      setIsIos(true);
      const timer = setTimeout(() => setVisible(true), 6000);
      return () => clearTimeout(timer);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(var(--nav-height)+var(--safe-bottom)+0.75rem)] z-[80] mx-auto max-w-[480px] animate-fade-up">
      <div className="card-dark flex items-center gap-3 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" width={44} height={44} className="relative h-11 w-11 shrink-0 rounded-2xl object-cover" />
        <div className="relative flex-1">
          <p className="text-xs font-extrabold text-white">پرشین پدل را نصب کنید</p>
          <p className="mt-1 text-[11px] leading-5 text-sky-light/80">
            {isIos
              ? 'در سافاری روی «اشتراک‌گذاری» بزنید و «افزودن به صفحه اصلی» را انتخاب کنید.'
              : 'دسترسی سریع، تجربه‌ی تمام‌صفحه و کارکرد آفلاین.'}
          </p>
        </div>
        <div className="relative flex shrink-0 flex-col gap-1.5">
          {!isIos && (
            <button type="button" onClick={install} className="btn-accent btn-sm">
              نصب
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-sky-light/70 transition hover:text-white"
          >
            بعداً
          </button>
        </div>
      </div>
    </div>
  );
}
