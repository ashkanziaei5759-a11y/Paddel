import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { RequestList } from './RequestList';

export const metadata: Metadata = { title: 'درخواست‌های پارتنری' };
export const dynamic = 'force-dynamic';

export default async function PartnerRequestsPage() {
  const user = await requirePage();

  const [incoming, outgoing, unread] = await Promise.all([
    prisma.partnerRequest.findMany({
      where: { receiverId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        tournament: { select: { id: true, name: true, startsAt: true, entryFee: true } },
        sender: { include: { profile: true } },
      },
    }),
    prisma.partnerRequest.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        tournament: { select: { id: true, name: true, startsAt: true, entryFee: true } },
        receiver: { include: { profile: true } },
      },
    }),
    unreadCount(user.id),
  ]);

  const toDto = (r: (typeof incoming)[number] | (typeof outgoing)[number], isIncoming: boolean) => {
    const other = isIncoming
      ? (r as (typeof incoming)[number]).sender
      : (r as (typeof outgoing)[number]).receiver;
    return {
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      tournamentId: r.tournament.id,
      tournamentName: r.tournament.name,
      tournamentStartsAt: r.tournament.startsAt.toISOString(),
      entryFee: r.tournament.entryFee.toString(),
      otherName: `${other.profile?.firstName ?? ''} ${other.profile?.lastName ?? ''}`.trim(),
      otherUsername: other.username,
      otherLevel: other.profile?.level ?? null,
      otherAvatar: other.profile?.avatarUrl ?? null,
    };
  };

  const incomingDto = incoming.map((r) => toDto(r, true));
  const outgoingDto = outgoing.map((r) => toDto(r, false));

  return (
    <>
      <TopBar
        title="درخواست‌های پارتنری"
        subtitle="دعوت‌های هم‌تیمی شدن"
        unread={unread}
        back="/profile"
      />

      <div className="page-pad pt-2">
        {incomingDto.length === 0 && outgoingDto.length === 0 ? (
          <EmptyState
            icon="partner"
            title="درخواستی وجود ندارد"
            description="برای شرکت در تورنومنت‌ها، یک پارتنر انتخاب کنید و برایش درخواست بفرستید."
            actionLabel="مشاهده تورنومنت‌ها"
            actionHref="/tournaments"
          />
        ) : (
          <RequestList incoming={incomingDto} outgoing={outgoingDto} />
        )}
      </div>
    </>
  );
}
