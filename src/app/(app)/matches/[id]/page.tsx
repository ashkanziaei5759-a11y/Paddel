import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { PendingRequests } from './PendingRequests';
import { unreadCount } from '@/lib/notifications';
import { MatchCard, type MatchDto } from '@/components/match/MatchCard';
import { Dot } from '@/components/ui/Dot';
import { formatDateTime, formatTime, toFaDigits } from '@/lib/datetime';
import { formatToman } from '@/lib/utils';

export const metadata: Metadata = { title: 'بازی' };
export const dynamic = 'force-dynamic';

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage();
  const { id } = await params;

  const [match, unread] = await Promise.all([
    prisma.openMatch.findUnique({
      where: { id },
      include: {
        booking: { include: { court: true } },
        players: {
          include: { user: { include: { profile: true } } },
          orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    }),
    unreadCount(user.id),
  ]);

  if (!match) notFound();

  const dto: MatchDto = {
    id: match.id,
    code: match.code,
    courtName: match.booking.court.name,
    startsAt: match.booking.startsAt.toISOString(),
    endsAt: match.booking.endsAt.toISOString(),
    capacity: match.capacity,
    share: match.sharePerPlayer.toString(),
    levelPolicy: match.levelPolicy,
    allowedLevels: match.allowedLevels,
    notes: match.notes,
    status: match.status,
    /* بازیکنِ در انتظار هنوز عضو بازی نیست، پس روی کارت نشان داده نمی‌شود */
    players: match.players
      .filter((p) => p.status === 'APPROVED')
      .map((p) => ({
      userId: p.userId,
      firstName: p.user.profile?.firstName ?? '؟',
      lastName: p.user.profile?.lastName ?? '',
      avatarUrl: p.user.profile?.avatarUrl ?? null,
      level: p.user.profile?.level ?? null,
        isHost: p.isHost,
      })),
  };

  const isHost = match.hostId === user.id;

  const pending = match.players
    .filter((p) => p.status === 'PENDING')
    .map((p) => ({
      userId: p.userId,
      firstName: p.user.profile?.firstName ?? '؟',
      lastName: p.user.profile?.lastName ?? '',
      avatarUrl: p.user.profile?.avatarUrl ?? null,
      level: p.user.profile?.level ?? null,
    }));

  /* بازیکنی که خودش منتظر است باید بداند چرا هنوز روی کارت نیست */
  const viewerPending = match.players.some(
    (p) => p.userId === user.id && p.status === 'PENDING',
  );

  return (
    <>
      <TopBar user={user} unread={unread} title="بازی باز" subtitle={match.code} back="/matches" />

      <div className="page-pad stagger space-y-4 pt-1">
        <MatchCard match={dto} viewerId={user.id} />

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">جزئیات</h2>
          <dl className="space-y-2.5 text-[11.5px]">
            <Row label="زمین" value={match.booking.court.name} />
            <Row label="زمان" value={formatDateTime(match.booking.startsAt)} />
            <Row
              label="مدت"
              value={`${formatTime(match.booking.startsAt)} تا ${formatTime(match.booking.endsAt)}`}
            />
            <Row label="ظرفیت" value={`${toFaDigits(match.capacity)} نفر`} />
            <Row label="سهم هر نفر" value={formatToman(match.sharePerPlayer)} />
            <Row label="هزینه‌ی کل زمین" value={formatToman(match.booking.totalPrice)} />
          </dl>
        </section>

        {isHost && <PendingRequests matchId={match.id} players={pending} />}

        {viewerPending && (
          <p className="rounded-2xl bg-accent-50 px-4 py-3 text-[11px] font-bold leading-6 text-accent-700">
            درخواست شما برای میزبان فرستاده شد و جای شما نگه داشته شده است. تا زمان تأیید،
            سهم شما نزد باشگاه می‌ماند؛ اگر میزبان رد کند، کامل بازمی‌گردد.
          </p>
        )}

        {isHost && (
          <p className="rounded-2xl bg-accent-50 px-4 py-3 text-[11px] font-bold leading-6 text-accent-700">
            شما میزبان این بازی هستید. سهم بازیکنان نزد باشگاه می‌ماند و پس از برگزاری بازی
            یک‌جا به کیف پول شما واریز می‌شود. اگر رزرو را لغو کنید، سهم همه بی‌کم‌وکاست
            بازمی‌گردد.
          </p>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-50 pb-2.5 last:border-0 last:pb-0">
      <dt className="font-bold text-brand-400">{label}</dt>
      <dd className="num font-extrabold text-brand-700">{value}</dd>
    </div>
  );
}
