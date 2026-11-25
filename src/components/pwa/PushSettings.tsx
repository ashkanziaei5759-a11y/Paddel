'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, ChevronDown, Smartphone, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type Status = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const PROMPT_DISMISS_KEY = 'pp_push_prompt_dismissed_at';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function detect(): { supported: boolean; ios: boolean; standalone: boolean } {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, ios, standalone };
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

/**
 * روشن/خاموش کردن اعلان روی گوشی + راهنمای فعال‌سازی.
 * variant="card": کارت کامل در صفحه‌ی اعلان‌ها.
 * variant="prompt": یادآور کوچک در صفحه‌ی اصلی، فقط وقتی اعلان خاموش است.
 */
export function PushSettings({ variant = 'card' }: { variant?: 'card' | 'prompt' }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ios, setIos] = useState(false);

  const refresh = useCallback(async () => {
    const env = detect();
    setIos(env.ios);
    /* آیفون فقط وقتی اپ به صفحه‌ی اصلی اضافه شده باشد اعلان می‌گیرد */
    if (env.ios && !env.standalone) return setStatus('ios-install');
    if (!env.supported) return setStatus('unsupported');
    if (Notification.permission === 'denied') return setStatus('denied');
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        /* اشتراک را دوباره به سرور می‌دهیم — شاید با حساب دیگری وارد شده باشد */
        void fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
        return setStatus('on');
      }
    } catch {
      /* Service Worker هنوز آماده نیست */
    }
    setStatus('off');
  }, []);

  useEffect(() => {
    if (variant === 'prompt') {
      try {
        const at = Number(localStorage.getItem(PROMPT_DISMISS_KEY) || 0);
        if (at && Date.now() - at < 7 * 86_400_000) setHidden(true);
      } catch {
        /* حافظه‌ی مرورگر در دسترس نیست */
      }
    }
    void refresh();
  }, [refresh, variant]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        if (permission === 'denied') setGuideOpen(true);
        return;
      }
      const keyRes = await fetch('/api/push');
      const keyJson = await keyRes.json();
      if (!keyRes.ok || !keyJson.ok) throw new Error(keyJson.error || 'کلید اعلان دریافت نشد.');

      const reg = await registration();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.data.publicKey) as BufferSource,
      });
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'ثبت گوشی ناموفق بود.');

      setStatus('on');
      toast.success('اعلان‌ها روشن شد. یک اعلان آزمایشی برایتان فرستادیم.');
      void fetch('/api/push/test', { method: 'POST' });
    } catch (error) {
      toast.error((error as Error).message || 'روشن کردن اعلان ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
      toast.success('اعلان روی این گوشی خاموش شد.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'ارسال نشد.');
      toast.success('اعلان آزمایشی فرستاده شد؛ چند ثانیه‌ی دیگر روی گوشی می‌آید.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const guide = (
    <div className="space-y-3 text-[11.5px] font-semibold leading-7 text-brand-500">
      <div>
        <p className="font-extrabold text-brand-700">گوشی اندروید (Chrome)</p>
        <ol className="list-inside list-decimal">
          <li>سایت باشگاه را با Chrome باز کنید و وارد حسابتان شوید.</li>
          <li>بهتر است از منوی ⋮ گزینه‌ی «افزودن به صفحه‌ی اصلی» را بزنید تا اپ مثل برنامه نصب شود.</li>
          <li>در صفحه‌ی «اعلان‌ها» دکمه‌ی «روشن کردن اعلان» را بزنید و در پنجره‌ی باز شده «Allow / اجازه» را انتخاب کنید.</li>
        </ol>
      </div>
      <div>
        <p className="font-extrabold text-brand-700">آیفون (iOS نسخه‌ی ۱۶٫۴ به بعد)</p>
        <ol className="list-inside list-decimal">
          <li>سایت را با Safari باز کنید.</li>
          <li>دکمه‌ی اشتراک‌گذاری (مربع با فلش رو به بالا) ← «Add to Home Screen».</li>
          <li>اپ را از آیکون روی صفحه‌ی اصلی باز کنید (نه از Safari) و وارد حساب شوید.</li>
          <li>به «اعلان‌ها» بروید، «روشن کردن اعلان» را بزنید و «Allow» را انتخاب کنید.</li>
        </ol>
      </div>
      <div>
        <p className="font-extrabold text-brand-700">اگر قبلاً «Block / اجازه نده» زده‌اید</p>
        <p>
          اندروید: Chrome ← ⋮ ← Settings ← Site settings ← Notifications ← سایت باشگاه را Allow کنید.
          آیفون: Settings ← Notifications ← اپ باشگاه ← Allow Notifications.
        </p>
      </div>
      <p className="text-brand-400">
        اعلان‌ها روی همان گوشی‌ای می‌آید که روشنشان کرده‌اید. اگر چند گوشی دارید، روی هرکدام جدا روشن کنید.
      </p>
    </div>
  );

  if (variant === 'prompt') {
    if (hidden || status === 'loading' || status === 'on' || status === 'unsupported') return null;
    return (
      <section className="card relative flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
          <BellRing className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-brand-800">یادآوری بازی را روی گوشی بگیرید</p>
          <p className="mt-1 text-[11px] leading-6 text-brand-500">
            {status === 'ios-install'
              ? 'در آیفون اول اپ را با Share ← Add to Home Screen نصب کنید، بعد از همان آیکون اعلان‌ها را روشن کنید.'
              : 'یک ساعت قبل از بازی و برای خبرهای باشگاه روی گوشی‌تان اعلان می‌آید.'}
          </p>
          {status === 'off' && (
            <button type="button" onClick={enable} disabled={busy} className="btn-accent btn-sm mt-2.5">
              {busy ? <Spinner /> : 'روشن کردن اعلان'}
            </button>
          )}
          {status === 'denied' && (
            <a href="/notifications" className="btn-outline btn-sm mt-2.5 inline-flex">
              راهنمای فعال‌سازی
            </a>
          )}
        </div>
        <button
          type="button"
          aria-label="بستن"
          onClick={() => {
            try {
              localStorage.setItem(PROMPT_DISMISS_KEY, String(Date.now()));
            } catch {
              /* نادیده */
            }
            setHidden(true);
          }}
          className="shrink-0 rounded-full p-1 text-brand-300 hover:text-brand-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            status === 'on' ? 'bg-success/15 text-success' : 'bg-brand-50 text-brand-600',
          )}
        >
          {status === 'on' ? (
            <BellRing className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          ) : status === 'ios-install' ? (
            <Smartphone className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <BellOff className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-brand-800">اعلان روی گوشی</p>
          <p className="mt-1 text-[11px] leading-6 text-brand-500">
            {status === 'loading' && 'در حال بررسی…'}
            {status === 'on' && 'روشن است. یادآوری بازی (یک ساعت قبل) و پیام‌های باشگاه روی این گوشی می‌آید.'}
            {status === 'off' && 'خاموش است. روشنش کنید تا یادآوری بازی و خبرهای باشگاه حتی وقتی اپ بسته است برسد.'}
            {status === 'denied' && 'اجازه‌ی اعلان در مرورگر بسته شده. از راهنمای زیر آن را باز کنید و صفحه را دوباره باز کنید.'}
            {status === 'ios-install' &&
              'در آیفون، اعلان فقط وقتی کار می‌کند که اپ به صفحه‌ی اصلی اضافه شده باشد. راهنمای زیر را ببینید.'}
            {status === 'unsupported' && 'این مرورگر اعلان را پشتیبانی نمی‌کند. با Chrome (اندروید) یا Safari (آیفون) باز کنید.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status === 'off' && (
          <button type="button" onClick={enable} disabled={busy} className="btn-accent btn-sm flex-1">
            {busy ? <Spinner /> : 'روشن کردن اعلان'}
          </button>
        )}
        {status === 'on' && (
          <>
            <button type="button" onClick={test} disabled={busy} className="btn-outline btn-sm flex-1">
              {busy ? <Spinner /> : 'ارسال اعلان آزمایشی'}
            </button>
            <button type="button" onClick={disable} disabled={busy} className="btn-outline btn-sm">
              خاموش کردن
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          aria-expanded={guideOpen}
          className="btn-outline btn-sm"
        >
          راهنمای فعال‌سازی
          <ChevronDown className={cn('h-4 w-4 transition', guideOpen && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>

      {(guideOpen || (status === 'ios-install' && ios)) && guide}
    </section>
  );
}
