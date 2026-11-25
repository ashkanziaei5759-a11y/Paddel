'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Send, Users, User, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface PlayerOption {
  id: string;
  username: string;
  name: string;
}

export interface SentItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  sentAt: string;
  recipients: number;
  read: number;
}

export interface AttachmentOption {
  id: string;
  kind: 'بنر' | 'خبر';
  title: string;
  body: string;
  imageUrl: string;
  actionUrl: string;
}

/**
 * نوشتن و فرستادن اعلان: به یک بازیکن یا همه، با تصویر و لینک دلخواه.
 * بنر یا خبرِ موجود را می‌شود پیوست کرد تا عنوان، تصویر و لینکش پر شود.
 * پیام همگانی را می‌شود برای زمان مشخص زمان‌بندی کرد.
 */
export function Composer({
  players,
  recent,
  attachments,
}: {
  players: PlayerOption[];
  recent: SentItem[];
  attachments: AttachmentOption[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [audience, setAudience] = useState<'USER' | 'ALL_PLAYERS'>('ALL_PLAYERS');
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [attachment, setAttachment] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduleAt, setScheduleAt] = useState('');
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
  const scheduled = audience === 'ALL_PLAYERS' && when === 'later';
  const ready =
    title.trim().length >= 2 &&
    body.trim().length >= 2 &&
    (audience === 'ALL_PLAYERS' || userId !== '') &&
    (!scheduled || scheduleAt !== '');

  function attach(id: string) {
    setAttachment(id);
    const item = attachments.find((a) => a.id === id);
    if (!item) {
      setImageUrl('');
      setActionUrl('');
      return;
    }
    setTitle(item.title.slice(0, 120));
    setBody((item.body || item.title).slice(0, 1000));
    setImageUrl(item.imageUrl);
    setActionUrl(item.actionUrl);
  }

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
          imageUrl: imageUrl.trim() || null,
          actionUrl: actionUrl.trim() || null,
          scheduleAt: scheduled ? new Date(scheduleAt).toISOString() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'ارسال نشد.');

      toast.success(
        json.data.scheduled
          ? `اعلان برای ${formatDateTime(new Date(json.data.scheduled))} زمان‌بندی شد (در تب اعلان‌های خودکار).`
          : `اعلان برای ${toFaDigits(json.data.sent)} نفر ارسال شد.`,
      );
      setTitle('');
      setBody('');
      setImageUrl('');
      setActionUrl('');
      setAttachment('');
      setScheduleAt('');
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
              ['ALL_PLAYERS', 'همه‌ی بازیکنان', Users],
              ['USER', 'یک بازیکن', User],
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
            <label className="label" htmlFor="notify-search">بازیکن</label>
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
                  <li className="px-3 py-2 text-[11px] font-semibold text-brand-300">بازیکنی با این نام پیدا نشد.</li>
                )}
              </ul>
            )}
          </div>
        )}

        {attachments.length > 0 && (
          <div>
            <label className="label" htmlFor="notify-attach">پیوست بنر یا خبر (اختیاری)</label>
            <select
              id="notify-attach"
              className="field"
              value={attachment}
              onChange={(e) => attach(e.target.value)}
            >
              <option value="">بدون پیوست</option>
              {attachments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.kind}: {a.title}
                </option>
              ))}
            </select>
            <p className="helper">عنوان، متن، تصویر و لینکش خودکار پر می‌شود؛ می‌توانید ویرایششان کنید.</p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="notify-title">عنوان</label>
          <input
            id="notify-title"
            className="field"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً: تخفیف ۲۰٪ سانس‌های صبح این هفته"
          />
        </div>

        <div>
          <label className="label" htmlFor="notify-body">متن پیام</label>
          <textarea
            id="notify-body"
            className="field min-h-[110px] resize-y py-3 leading-7"
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="متن کامل اعلان…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="notify-link">لینک با لمس اعلان (اختیاری)</label>
            <input
              id="notify-link"
              className="field text-left"
              dir="ltr"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/booking"
            />
          </div>
          <div>
            <label className="label" htmlFor="notify-image">آدرس تصویر (اختیاری)</label>
            <input
              id="notify-image"
              className="field text-left"
              dir="ltr"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/uploads/…"
            />
          </div>
        </div>

        {imageUrl && (
          <div className="relative overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="aspect-[2/1] w-full object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              aria-label="حذف تصویر"
              className="absolute left-2 top-2 rounded-full bg-black/50 p-1 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-bold text-white">
              <ImageIcon className="h-3 w-3" aria-hidden="true" />
              در اعلان گوشی‌های اندروید بزرگ نمایش داده می‌شود
            </span>
          </div>
        )}

        {audience === 'ALL_PLAYERS' && (
          <div className="space-y-2">
            <p className="label">زمان ارسال</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['now', 'همین حالا'],
                  ['later', 'زمان مشخص'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={when === value}
                  onClick={() => setWhen(value)}
                  className={cn(
                    'rounded-2xl px-3 py-2.5 text-[11.5px] font-black transition',
                    when === value ? 'bg-primary text-on-primary' : 'bg-surface-muted text-brand-400',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {when === 'later' && (
              <input
                type="datetime-local"
                className="field num text-left"
                dir="ltr"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            )}
          </div>
        )}

        {confirming ? (
          <div className="rounded-2xl bg-accent-50 p-3.5">
            <p className="text-[11.5px] font-bold leading-6 text-accent-700">
              {audience === 'ALL_PLAYERS'
                ? scheduled
                  ? `این پیام در ${formatDateTime(new Date(scheduleAt))} برای همه‌ی بازیکنان فعال فرستاده می‌شود.`
                  : `این پیام برای ${toFaDigits(players.length)} بازیکن فرستاده می‌شود و قابل بازگرداندن نیست.`
                : `این پیام برای ${chosen?.name ?? '—'} فرستاده می‌شود.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={send} disabled={sending} className="btn-accent btn-sm flex-1">
                {sending ? <Spinner /> : scheduled ? 'بله، زمان‌بندی کن' : 'بله، بفرست'}
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
              <li key={n.id} className="flex gap-3 rounded-2xl border border-brand-100 p-3">
                {n.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-extrabold text-brand-800">{n.title}</p>
                  <p className="mt-1 line-clamp-2 text-[10.5px] font-semibold leading-6 text-brand-400">{n.body}</p>
                  <p className="num mt-1.5 text-[10px] font-bold text-brand-300">
                    {formatDateTime(new Date(n.sentAt))} · {toFaDigits(n.recipients)} گیرنده ·{' '}
                    {toFaDigits(n.read)} خوانده
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
