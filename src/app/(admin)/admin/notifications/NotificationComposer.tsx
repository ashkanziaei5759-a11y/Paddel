'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Users, User } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatJalaliDate, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

interface PlayerOption {
  id: string;
  username: string;
  name: string;
}

interface SentItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  to: string;
}

/**
 * نوشتن و فرستادن اعلان.
 *
 * ارسال همگانی برگشت‌پذیر نیست، پس پیش از فرستادن تعداد گیرنده‌ها نشان داده
 * می‌شود و دکمه یک بار تأیید می‌خواهد.
 */
export function NotificationComposer({
  players,
  recent,
}: {
  players: PlayerOption[];
  recent: SentItem[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [audience, setAudience] = useState<'USER' | 'ALL_PLAYERS'>('USER');
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return players.slice(0, 8);
    return players
      .filter((p) => p.name.includes(q) || p.username.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
  }, [players, query]);

  const chosen = players.find((p) => p.id === userId) ?? null;
  const ready = title.trim().length >= 2 && body.trim().length >= 2 &&
    (audience === 'ALL_PLAYERS' || userId !== '');

  async function send() {
    setSending(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          userId: audience === 'USER' ? userId : undefined,
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'ارسال نشد.');

      toast.success(`اعلان برای ${toFaDigits(json.data.sent)} نفر ارسال شد.`);
      setTitle('');
      setBody('');
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ارسال نشد.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['USER', 'یک بازیکن', User],
              ['ALL_PLAYERS', 'همه‌ی بازیکنان', Users],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setAudience(value);
                setConfirming(false);
              }}
              aria-pressed={audience === value}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[11.5px] font-black transition',
                audience === value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-muted text-brand-400 hover:text-brand-600',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {audience === 'USER' && (
          <div>
            <label className="label" htmlFor="notify-search">
              بازیکن
            </label>
            <input
              id="notify-search"
              className="field"
              placeholder="جست‌وجوی نام یا نام کاربری"
              value={chosen ? chosen.name : query}
              onChange={(e) => {
                setQuery(e.target.value);
                setUserId('');
              }}
            />
            {!chosen && (
              <ul className="mt-2 space-y-1">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setUserId(p.id);
                        setQuery('');
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right text-[11.5px] font-bold text-brand-700 transition hover:bg-surface-muted"
                    >
                      <span className="truncate">{p.name}</span>
                      <span dir="ltr" className="shrink-0 text-[10px] font-semibold text-brand-300">
                        @{p.username}
                      </span>
                    </button>
                  </li>
                ))}
                {matches.length === 0 && (
                  <li className="px-3 py-2 text-[11px] font-semibold text-brand-300">
                    بازیکنی با این نام پیدا نشد.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div>
          <label className="label" htmlFor="notify-title">
            عنوان
          </label>
          <input
            id="notify-title"
            className="field"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً: تعطیلی باشگاه در روز جمعه"
          />
        </div>

        <div>
          <label className="label" htmlFor="notify-body">
            متن پیام
          </label>
          <textarea
            id="notify-body"
            className="field min-h-[110px] resize-y py-3 leading-7"
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="متن کامل اعلان…"
          />
        </div>

        {confirming ? (
          <div className="rounded-2xl bg-accent-50 p-3.5">
            <p className="text-[11.5px] font-bold leading-6 text-accent-700">
              {audience === 'ALL_PLAYERS'
                ? `این پیام برای ${toFaDigits(players.length)} بازیکن فرستاده می‌شود و قابل بازگرداندن نیست.`
                : `این پیام برای ${chosen?.name ?? '—'} فرستاده می‌شود.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="btn-accent btn-sm flex-1"
              >
                {sending ? <Spinner /> : 'بله، بفرست'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="btn-outline btn-sm flex-1"
              >
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!ready}
            className="btn-primary w-full disabled:opacity-50"
          >
            <Send className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            بررسی و ارسال
          </button>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-extrabold text-brand-800">آخرین پیام‌های فرستاده‌شده</h2>
        {recent.length === 0 ? (
          <p className="text-[11.5px] font-semibold text-brand-300">هنوز پیامی نفرستاده‌اید.</p>
        ) : (
          <ul className="space-y-2.5">
            {recent.map((n) => (
              <li key={n.id} className="rounded-2xl border border-brand-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold text-brand-800">
                    {n.title}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 rounded-lg px-1.5 py-0.5 text-[9px] font-black',
                      n.read ? 'bg-success/15 text-success' : 'bg-brand-100 text-brand-500',
                    )}
                  >
                    {n.read ? 'خوانده شد' : 'خوانده‌نشده'}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10.5px] font-semibold leading-6 text-brand-400">
                  {n.body}
                </p>
                <p className="mt-1.5 text-[10px] font-bold text-brand-300">
                  {n.to} — {formatJalaliDate(new Date(n.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
