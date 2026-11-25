'use client';

import { useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { Segmented } from '@/components/ui/Segmented';
import { toFaDigits } from '@/lib/datetime';
import { Composer, type AttachmentOption, type PlayerOption, type SentItem } from './Composer';
import { RulesManager, type RuleDto } from './RulesManager';

export function NotificationsAdmin({
  pushStats,
  players,
  recent,
  attachments,
  rules,
}: {
  pushStats: { players: number; withPush: number };
  players: PlayerOption[];
  recent: SentItem[];
  attachments: AttachmentOption[];
  rules: RuleDto[];
}) {
  const [tab, setTab] = useState<'send' | 'rules'>('send');
  const percent = pushStats.players ? Math.round((pushStats.withPush / pushStats.players) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Smartphone className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="num text-sm font-black text-brand-800">
              {toFaDigits(pushStats.withPush)} از {toFaDigits(pushStats.players)} بازیکن ({toFaDigits(percent)}٪)
            </p>
            <p className="text-[10.5px] font-semibold text-brand-400">اعلان گوشی را روشن کرده‌اند</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <BellRing className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="text-[10.5px] font-semibold leading-6 text-brand-500">
            همه‌ی پیام‌ها در بخش «اعلان‌ها»ی اپ هم می‌ماند. بازیکنانی که اعلان گوشی را روشن نکرده‌اند،
            در صفحه‌ی اصلی اپ پیشنهاد روشن کردنش را می‌بینند.
          </p>
        </div>
      </section>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'send', label: 'ارسال پیام و خبر' },
          { value: 'rules', label: 'اعلان‌های خودکار', count: rules.filter((r) => r.isActive).length },
        ]}
      />

      {tab === 'send' ? (
        <Composer players={players} recent={recent} attachments={attachments} />
      ) : (
        <RulesManager rules={rules} />
      )}
    </div>
  );
}
