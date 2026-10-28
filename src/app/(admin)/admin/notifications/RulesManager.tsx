'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Clock, Moon, Pencil, Plus, Trash2, Wallet, Star } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatRelative, toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

type Trigger = 'BEFORE_BOOKING' | 'AFTER_BOOKING' | 'INACTIVE_PLAYER' | 'LOW_WALLET' | 'SCHEDULED';

export interface RuleDto {
  id: string;
  name: string;
  trigger: Trigger;
  offset: number;
  thresholdToman: number | null;
  runAt: string | null;
  title: string;
  body: string;
  actionUrl: string;
  imageUrl: string;
  isActive: boolean;
  sentCount: number;
  lastRunAt: string | null;
}

const TRIGGERS: { value: Trigger; label: string; hint: string; Icon: typeof Clock }[] = [
  { value: 'BEFORE_BOOKING', label: 'قبل از شروع بازی', hint: 'چند دقیقه پیش از شروع هر رزرو', Icon: Clock },
  { value: 'AFTER_BOOKING', label: 'بعد از پایان بازی', hint: 'مثلاً تشکر یا نظرسنجی', Icon: Star },
  { value: 'INACTIVE_PLAYER', label: 'بازیکن غیرفعال', hint: 'چند روز است رزرو نکرده', Icon: Moon },
  { value: 'LOW_WALLET', label: 'کیف پول کم', hint: 'موجودی کمتر از یک مبلغ', Icon: Wallet },
  { value: 'SCHEDULED', label: 'یک بار در زمان مشخص', hint: 'برای همه‌ی بازیکنان', Icon: CalendarClock },
];

const PLACEHOLDERS = [
  { key: '{name}', label: 'نام بازیکن', for: 'all' },
  { key: '{court}', label: 'زمین', for: 'booking' },
  { key: '{time}', label: 'ساعت بازی', for: 'booking' },
  { key: '{date}', label: 'تاریخ بازی', for: 'booking' },
  { key: '{balance}', label: 'موجودی', for: 'LOW_WALLET' },
  { key: '{days}', label: 'تعداد روز', for: 'INACTIVE_PLAYER' },
] as const;

const SAMPLE: Record<string, string> = {
  name: 'علی',
  court: 'زمین ۱',
  time: '۱۹:۳۰',
  date: 'سه‌شنبه، ۶ آبان',
  balance: '۸۰٬۰۰۰ تومان',
  days: '۱۴',
};

/** قالب‌های آماده برای ساخت سریع */
const PRESETS: Omit<RuleDto, 'id' | 'sentCount' | 'lastRunAt' | 'isActive' | 'runAt' | 'imageUrl'>[] = [
  {
    name: 'یادآوری یک ساعت پیش از بازی',
    trigger: 'BEFORE_BOOKING',
    offset: 60,
    thresholdToman: null,
    title: 'یادآوری بازی ⏰',
    body: '{name} عزیز، ساعت {time} زمین پدل ({court}) به نام شماست. منتظرتان هستیم!',
    actionUrl: '',
  },
  {
    name: 'یادآوری روز قبل',
    trigger: 'BEFORE_BOOKING',
    offset: 24 * 60,
    thresholdToman: null,
    title: 'فردا بازی دارید 🎾',
    body: '{name} عزیز، {date} ساعت {time} در {court} بازی دارید.',
    actionUrl: '',
  },
  {
    name: 'تشکر بعد از بازی',
    trigger: 'AFTER_BOOKING',
    offset: 30,
    thresholdToman: null,
    title: 'ممنون که امروز با ما بازی کردید',
    body: '{name} عزیز، امیدواریم بازی خوبی داشتید. سانس بعدی‌تان را از همین حالا رزرو کنید.',
    actionUrl: '/booking',
  },
  {
    name: 'دلتنگی ۱۴ روزه',
    trigger: 'INACTIVE_PLAYER',
    offset: 14,
    thresholdToman: null,
    title: 'دلمان برایتان تنگ شده 💙',
    body: '{name} عزیز، {days} روز است به زمین نیامده‌اید. یک سانس رزرو کنید و دوباره راکت بزنید!',
    actionUrl: '/booking',
  },
  {
    name: 'کیف پول کم',
    trigger: 'LOW_WALLET',
    offset: 0,
    thresholdToman: 100_000,
    title: 'موجودی کیف پولتان کم است',
    body: '{name} عزیز، موجودی کیف پول شما {balance} است. برای رزرو بعدی شارژش کنید.',
    actionUrl: '/wallet',
  },
];

function describe(rule: Pick<RuleDto, 'trigger' | 'offset' | 'thresholdToman' | 'runAt'>): string {
  const minutes = (m: number) =>
    m % 1440 === 0 ? `${toFaDigits(m / 1440)} روز` : m % 60 === 0 ? `${toFaDigits(m / 60)} ساعت` : `${toFaDigits(m)} دقیقه`;
  switch (rule.trigger) {
    case 'BEFORE_BOOKING':
      return `${minutes(rule.offset)} پیش از شروع هر رزرو`;
    case 'AFTER_BOOKING':
      return `${minutes(rule.offset)} پس از پایان هر رزرو`;
    case 'INACTIVE_PLAYER':
      return `بازیکنی که ${toFaDigits(rule.offset)} روز رزرو نکرده (هر ${toFaDigits(rule.offset)} روز حداکثر یک بار، ۱۰ صبح تا ۹ شب)`;
    case 'LOW_WALLET':
      return `موجودی کمتر از ${toFaDigits((rule.thresholdToman ?? 0).toLocaleString('en-US'))} تومان (هفته‌ای حداکثر یک بار، ۱۰ صبح تا ۹ شب)`;
    case 'SCHEDULED':
      return rule.runAt ? `یک بار در ${formatDateTime(new Date(rule.runAt))} برای همه` : 'یک بار';
  }
}

/** datetime-local به وقت مرورگر ← رشته‌ی ورودی */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: RuleDto = {
  id: '',
  name: '',
  trigger: 'BEFORE_BOOKING',
  offset: 60,
  thresholdToman: null,
  runAt: null,
  title: '',
  body: '',
  actionUrl: '',
  imageUrl: '',
  isActive: true,
  sentCount: 0,
  lastRunAt: null,
};

/**
 * قانون‌های اعلان خودکار: مدیر شرط و متن را تعیین می‌کند و سرور هر دقیقه
 * بررسی و ارسال می‌کند. هیچ بازیکنی یک پیام را برای یک رویداد دو بار نمی‌گیرد.
 */
export function RulesManager({ rules }: { rules: RuleDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<RuleDto | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'انجام نشد.');
  }

  async function toggle(rule: RuleDto) {
    try {
      await request(`/api/admin/notification-rules/${rule.id}`, 'PATCH', { isActive: !rule.isActive });
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function remove(rule: RuleDto) {
    if (!window.confirm(`قانون «${rule.name}» حذف شود؟`)) return;
    try {
      await request(`/api/admin/notification-rules/${rule.id}`, 'DELETE');
      toast.success('قانون حذف شد.');
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const payload = {
        name: editing.name,
        trigger: editing.trigger,
        offset: editing.trigger === 'LOW_WALLET' || editing.trigger === 'SCHEDULED' ? 0 : editing.offset,
        thresholdToman: editing.trigger === 'LOW_WALLET' ? editing.thresholdToman : null,
        runAt: editing.trigger === 'SCHEDULED' && editing.runAt ? new Date(editing.runAt).toISOString() : null,
        title: editing.title,
        body: editing.body,
        actionUrl: editing.actionUrl,
        imageUrl: editing.imageUrl,
        isActive: editing.isActive,
      };
      if (editing.id) await request(`/api/admin/notification-rules/${editing.id}`, 'PATCH', payload);
      else await request('/api/admin/notification-rules', 'POST', payload);
      toast.success('قانون ذخیره شد. از دقیقه‌ی بعد اجرا می‌شود.');
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof RuleDto>(key: K, value: RuleDto[K]) =>
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));

  const isBooking = editing?.trigger === 'BEFORE_BOOKING' || editing?.trigger === 'AFTER_BOOKING';
  const placeholders = PLACEHOLDERS.filter(
    (p) => p.for === 'all' || (p.for === 'booking' ? isBooking : p.for === editing?.trigger),
  );
  const preview = (text: string) => text.replace(/\{(\w+)\}/g, (m, k: string) => SAMPLE[k] ?? m);

  /* واحد زمان برای قانون‌های رزرو: دقیقه/ساعت/روز */
  const unit = editing && editing.offset % 1440 === 0 && editing.offset > 0 ? 1440 : editing && editing.offset % 60 === 0 ? 60 : 1;

  return (
    <div className="space-y-3">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-[11.5px] font-semibold leading-6 text-brand-500">
          شرط را انتخاب کنید و متن پیام را بنویسید؛ سرور هر دقیقه بررسی می‌کند و برای هر بازیکن (و هر
          رزرو) فقط یک بار می‌فرستد. پیام‌ها هم در اعلان‌های اپ و هم روی گوشی می‌آیند.
        </p>
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn-primary btn-sm shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          قانون جدید
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-xs font-bold text-brand-300">هنوز قانونی نساخته‌اید.</p>
        </div>
      ) : (
        <div className="card divide-y divide-brand-50 overflow-hidden">
          {rules.map((rule) => {
            const meta = TRIGGERS.find((t) => t.value === rule.trigger)!;
            return (
              <div key={rule.id} className={cn('flex flex-wrap items-start gap-3 p-3.5', !rule.isActive && 'opacity-60')}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <meta.Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-brand-800">{rule.name}</p>
                  <p className="mt-0.5 text-[10.5px] font-semibold leading-5 text-brand-400">{describe(rule)}</p>
                  <p className="mt-1 line-clamp-2 text-[10.5px] leading-5 text-brand-500">«{rule.body}»</p>
                  <p className="num mt-1 text-[10px] font-bold text-brand-300">
                    {toFaDigits(rule.sentCount)} ارسال
                    {rule.lastRunAt ? ` · آخرین: ${formatRelative(new Date(rule.lastRunAt))}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.isActive}
                    aria-label={rule.isActive ? 'خاموش کردن' : 'روشن کردن'}
                    onClick={() => toggle(rule)}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition',
                      rule.isActive ? 'bg-success' : 'bg-brand-200',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                        rule.isActive ? 'right-0.5' : 'right-[22px]',
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="ویرایش"
                    onClick={() => setEditing({ ...rule, runAt: toLocalInput(rule.runAt) })}
                    className="rounded-xl p-2 text-brand-400 hover:bg-surface-muted hover:text-brand-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="حذف"
                    onClick={() => remove(rule)}
                    className="rounded-xl p-2 text-brand-400 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'ویرایش قانون' : 'قانون اعلان جدید'}>
        {editing && (
          <form onSubmit={save} className="space-y-3">
            {!editing.id && (
              <div>
                <p className="label">شروع سریع با قالب آماده</p>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setEditing({ ...EMPTY, ...p })}
                      className="shrink-0 rounded-xl bg-surface-muted px-3 py-2 text-[10.5px] font-bold text-brand-600 hover:text-brand-800"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="rule-name">نام قانون (فقط برای خودتان)</label>
              <input id="rule-name" required className="field" maxLength={80} value={editing.name} onChange={(e) => set('name', e.target.value)} />
            </div>

            <div>
              <p className="label">شرط ارسال</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TRIGGERS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={editing.trigger === t.value}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        trigger: t.value,
                        offset: t.value === 'INACTIVE_PLAYER' ? 14 : t.value === 'AFTER_BOOKING' ? 30 : 60,
                        thresholdToman: t.value === 'LOW_WALLET' ? editing.thresholdToman ?? 100_000 : null,
                      })
                    }
                    className={cn(
                      'flex items-start gap-2 rounded-2xl border p-2.5 text-right transition',
                      editing.trigger === t.value ? 'border-primary bg-primary/10' : 'border-brand-100 hover:border-brand-200',
                    )}
                  >
                    <t.Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
                    <span>
                      <span className="block text-[11.5px] font-extrabold text-brand-800">{t.label}</span>
                      <span className="block text-[10px] font-semibold text-brand-400">{t.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {isBooking && (
              <div>
                <label className="label" htmlFor="rule-offset">
                  {editing.trigger === 'BEFORE_BOOKING' ? 'چه مدت قبل از شروع؟' : 'چه مدت بعد از پایان؟'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="rule-offset"
                    type="number"
                    min={1}
                    className="field num flex-1 text-left"
                    dir="ltr"
                    value={editing.offset / unit}
                    onChange={(e) => set('offset', Math.max(0, Math.round(Number(e.target.value) * unit)))}
                  />
                  <select
                    className="field w-28"
                    value={unit}
                    onChange={(e) => set('offset', Math.round((editing.offset / unit) * Number(e.target.value)))}
                    aria-label="واحد"
                  >
                    <option value={1}>دقیقه</option>
                    <option value={60}>ساعت</option>
                    <option value={1440}>روز</option>
                  </select>
                </div>
              </div>
            )}

            {editing.trigger === 'INACTIVE_PLAYER' && (
              <div>
                <label className="label" htmlFor="rule-days">چند روز بدون رزرو؟</label>
                <input
                  id="rule-days"
                  type="number"
                  min={1}
                  max={365}
                  className="field num text-left"
                  dir="ltr"
                  value={editing.offset}
                  onChange={(e) => set('offset', Math.round(Number(e.target.value)))}
                />
              </div>
            )}

            {editing.trigger === 'LOW_WALLET' && (
              <div>
                <label className="label" htmlFor="rule-threshold">وقتی موجودی کمتر از (تومان)</label>
                <input
                  id="rule-threshold"
                  inputMode="numeric"
                  className="field num text-left"
                  dir="ltr"
                  value={editing.thresholdToman ?? ''}
                  onChange={(e) => set('thresholdToman', Number(e.target.value.replace(/\D/g, '')) || null)}
                />
              </div>
            )}

            {editing.trigger === 'SCHEDULED' && (
              <div>
                <label className="label" htmlFor="rule-runat">زمان ارسال</label>
                <input
                  id="rule-runat"
                  type="datetime-local"
                  className="field num text-left"
                  dir="ltr"
                  value={editing.runAt ?? ''}
                  onChange={(e) => set('runAt', e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="rule-title">عنوان اعلان</label>
              <input id="rule-title" required maxLength={120} className="field" value={editing.title} onChange={(e) => set('title', e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="rule-body">متن اعلان</label>
              <textarea
                id="rule-body"
                required
                maxLength={1000}
                className="field min-h-[90px] resize-y py-2.5 leading-7"
                value={editing.body}
                onChange={(e) => set('body', e.target.value)}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {placeholders.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => set('body', `${editing.body}${editing.body.endsWith(' ') || !editing.body ? '' : ' '}${p.key}`)}
                    className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-600 hover:bg-brand-100"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="rule-link">لینک (اختیاری)</label>
                <input id="rule-link" dir="ltr" className="field text-left" placeholder="/booking" value={editing.actionUrl} onChange={(e) => set('actionUrl', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="rule-image">تصویر (اختیاری)</label>
                <input id="rule-image" dir="ltr" className="field text-left" placeholder="/uploads/…" value={editing.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
              </div>
            </div>

            {(editing.title || editing.body) && (
              <div className="rounded-2xl bg-surface-muted p-3">
                <p className="text-[10px] font-bold text-brand-300">پیش‌نمایش برای یک بازیکن نمونه</p>
                <p className="mt-1 text-xs font-extrabold text-brand-800">{preview(editing.title)}</p>
                <p className="mt-0.5 text-[11px] leading-6 text-brand-500">{preview(editing.body)}</p>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Spinner /> : 'ذخیره قانون'}
            </button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
