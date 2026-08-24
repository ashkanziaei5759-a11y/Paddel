'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import type { PlayerLevel } from '@prisma/client';
import { Segmented } from '@/components/ui/Segmented';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { PARTNER_REQUEST_STATUS_LABEL } from '@/lib/constants';
import { formatJalaliDate, formatRelative } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

export interface RequestDto {
  id: string;
  status: keyof typeof PARTNER_REQUEST_STATUS_LABEL;
  message: string | null;
  createdAt: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStartsAt: string;
  entryFee: string;
  otherName: string;
  otherUsername: string;
  otherLevel: PlayerLevel | null;
  otherAvatar: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'badge-accent',
  ACCEPTED: 'badge-success',
  REJECTED: 'badge-danger',
  CANCELLED: 'badge-muted',
  EXPIRED: 'badge-muted',
};

export function RequestList({
  incoming,
  outgoing,
}: {
  incoming: RequestDto[];
  outgoing: RequestDto[];
}) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>(
    incoming.some((r) => r.status === 'PENDING') || outgoing.length === 0 ? 'incoming' : 'outgoing',
  );

  const items = tab === 'incoming' ? incoming : outgoing;

  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'incoming', label: 'دریافتی', count: incoming.filter((r) => r.status === 'PENDING').length },
          { value: 'outgoing', label: 'ارسالی', count: outgoing.filter((r) => r.status === 'PENDING').length },
        ]}
      />

      {items.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-xs font-bold text-brand-300">
            {tab === 'incoming' ? 'درخواست دریافتی ندارید.' : 'درخواست ارسالی ندارید.'}
          </p>
        </div>
      ) : (
        <div className="stagger space-y-3">
          {items.map((request) => (
            <RequestCard key={request.id} request={request} canRespond={tab === 'incoming'} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, canRespond }: { request: RequestDto; canRespond: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<'ACCEPT' | 'REJECT' | 'CANCEL' | null>(null);

  const [first, ...rest] = request.otherName.split(' ');

  async function respond(action: 'ACCEPT' | 'REJECT') {
    setLoading(action);
    try {
      const res = await fetch(`/api/partner-requests/${request.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'ثبت پاسخ ناموفق بود.');
        return;
      }

      toast.success(
        action === 'ACCEPT'
          ? `تیم «${json.data.teamName}» ثبت شد. موفق باشید! 🏆`
          : 'درخواست رد شد.',
      );
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(null);
    }
  }

  async function cancelOutgoing() {
    setLoading('CANCEL');
    try {
      const res = await fetch(`/api/partner-requests/${request.id}`, { method: 'DELETE' });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        toast.error(json.error || 'لغو درخواست ناموفق بود.');
        return;
      }

      toast.success('درخواست شما لغو شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={cn('card p-4', request.status === 'PENDING' && 'ring-1 ring-accent/25')}>
      <div className="flex items-start gap-3">
        <Avatar
          firstName={first || '؟'}
          lastName={rest.join(' ') || ''}
          src={request.otherAvatar}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold text-brand-800">{request.otherName}</p>
              <p className="num truncate text-[10px] font-bold text-brand-300" dir="ltr">
                @{request.otherUsername}
              </p>
            </div>
            <span className={cn('shrink-0', STATUS_STYLE[request.status])}>
              {PARTNER_REQUEST_STATUS_LABEL[request.status]}
            </span>
          </div>

          {request.otherLevel && (
            <div className="mt-2">
              <LevelBadge level={request.otherLevel} size="sm" withLabel />
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/tournaments/${request.tournamentId}`}
        className="mt-3 block rounded-2xl bg-surface-muted px-3 py-2.5 transition hover:bg-brand-50"
      >
        <p className="truncate text-[11px] font-extrabold text-brand-700">
          🏆 {request.tournamentName}
        </p>
        <p className="mt-1 text-[10px] font-semibold text-brand-400">
          {formatJalaliDate(new Date(request.tournamentStartsAt), { withWeekday: true })}
          {BigInt(request.entryFee) > 0n && (
            <>
              <Dot />
              {`ورودی ${formatToman(BigInt(request.entryFee))}`}
            </>
          )}
        </p>
      </Link>

      {request.message && (
        <p className="mt-2 rounded-2xl bg-brand-50/60 px-3 py-2 text-[11px] leading-6 text-brand-500">
          «{request.message}»
        </p>
      )}

      <p className="mt-2 text-[10px] font-bold text-brand-300">
        {formatRelative(new Date(request.createdAt))}
      </p>

      {canRespond && request.status === 'PENDING' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => respond('REJECT')}
            disabled={loading !== null}
            className="btn-outline flex-1"
          >
            {loading === 'REJECT' ? <Spinner /> : 'رد کردن'}
          </button>
          <button
            type="button"
            onClick={() => respond('ACCEPT')}
            disabled={loading !== null}
            className="btn-accent flex-1"
          >
            {loading === 'ACCEPT' ? <Spinner /> : 'پذیرفتن'}
          </button>
        </div>
      )}

      {!canRespond && request.status === 'PENDING' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={cancelOutgoing}
            disabled={loading !== null}
            className="btn-outline w-full"
          >
            {loading === 'CANCEL' ? <Spinner /> : 'لغو درخواست'}
          </button>
        </div>
      )}
    </div>
  );
}
