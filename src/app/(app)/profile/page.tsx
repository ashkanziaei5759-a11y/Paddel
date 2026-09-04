import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { Avatar } from '@/components/ui/Avatar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { unreadCount } from '@/lib/notifications';
import { formatNumber, formatToman, maskPhone } from '@/lib/utils';
import { formatDateTime, formatJalaliDate, toFaDigits } from '@/lib/datetime';
import { POINTS_TX_LABEL, TOURNAMENT_STATUS_LABEL } from '@/lib/constants';
import { LogoutButton } from './LogoutButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ChevronLeft, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'پروفایل' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requirePage();

  const [wallet, bookingCount, unread, pointsTxs, teamMemberships, profile] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
    prisma.booking.count({ where: { userId: user.id, status: { in: ['CONFIRMED', 'COMPLETED'] } } }),
    unreadCount(user.id),
    prisma.pointsTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.teamMember.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        team: {
          include: {
            tournament: { select: { id: true, name: true, startsAt: true, status: true } },
            result: true,
            members: { include: { user: { include: { profile: true } } } },
          },
        },
      },
    }),
    prisma.profile.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <TopBar title="پروفایل" subtitle="اطلاعات حساب شما" unread={unread} />

      <div className="page-pad stagger space-y-4 pt-2">
        {/* ---- کارت پروفایل ---- */}
        <section className="card-dark p-6">
          <div className="relative flex items-center gap-4">
            <Avatar
              firstName={user.firstName}
              lastName={user.lastName}
              src={user.avatarUrl}
              size="xl"
              ring
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-black text-white">{user.fullName}</h2>
              <p className="num mt-1 text-xs font-bold text-sky-light/70" dir="ltr">
                @{user.username}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <LevelBadge level={user.level} />
                {user.role === 'ADMIN' && (
                  <span className="badge bg-white/15 text-white">مدیر باشگاه</span>
                )}
              </div>
            </div>
          </div>

          <div className="relative mt-5 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3">
            <Smartphone className="h-4 w-4 text-sky-light/70" strokeWidth={2} aria-hidden="true" />
            <span className="num flex-1 text-xs font-bold text-white" dir="ltr">
              {user.phone ? maskPhone(user.phone) : '—'}
            </span>
            {user.phoneVerified && (
              <span className="badge bg-success/25 text-white">تأیید شده</span>
            )}
          </div>
        </section>

        {/* ---- آمار ---- */}
        <section className="grid grid-cols-3 gap-3">
          <MiniStat label="امتیاز" value={formatNumber(user.points)} icon="points" />
          <MiniStat label="رزروها" value={formatNumber(bookingCount)} icon="booking" />
          <MiniStat
            label="کیف پول"
            value={formatToman(wallet?.balance ?? 0n, { withUnit: false })}
            icon="wallet"
          />
        </section>

        {profile?.bio && (
          <section className="card p-4">
            <p className="text-xs leading-6 text-brand-600">{profile.bio}</p>
          </section>
        )}

        {/* ---- تاریخچه امتیاز ---- */}
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">تاریخچه امتیاز</h2>
          {pointsTxs.length === 0 ? (
            <div className="card px-6 py-8 text-center">
              <p className="text-xs font-bold text-brand-300">هنوز امتیازی ثبت نشده است.</p>
            </div>
          ) : (
            <div className="card divide-y divide-brand-50 overflow-hidden">
              {pointsTxs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-black',
                      tx.amount > 0 ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-400',
                    )}
                  >
                    {tx.amount > 0 ? '+' : '−'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-brand-800">
                      {tx.description || POINTS_TX_LABEL[tx.type]}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-brand-300">
                      {formatDateTime(tx.createdAt, { withWeekday: false })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'num shrink-0 text-sm font-black',
                      tx.amount > 0 ? 'text-accent-500' : 'text-brand-400',
                    )}
                  >
                    {toFaDigits(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- تاریخچه تورنومنت ---- */}
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-brand-800">تاریخچه تورنومنت‌ها</h2>
          {teamMemberships.length === 0 ? (
            <div className="card px-6 py-8 text-center">
              <p className="text-xs font-bold text-brand-300">هنوز در تورنومنتی شرکت نکرده‌اید.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMemberships.map((m) => {
                const partner = m.team.members.find((x) => x.userId !== user.id);
                return (
                  <Link
                    key={m.id}
                    href={`/tournaments/${m.team.tournament.id}`}
                    className="card-interactive block p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-extrabold text-brand-800">
                        {m.team.tournament.name}
                      </p>
                      <span className="badge-muted shrink-0">
                        {TOURNAMENT_STATUS_LABEL[m.team.tournament.status]}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-brand-400">
                      {formatJalaliDate(m.team.tournament.startsAt)}
                      {partner?.user.profile && (
                        <>
                          <Dot />
                          {'پارتنر: '}
                          {partner.user.profile.firstName} {partner.user.profile.lastName}
                        </>
                      )}
                    </p>
                    {m.team.result && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="badge-accent num">
                          رتبه {toFaDigits(m.team.result.finalRank)}
                        </span>
                        {m.team.result.pointsAwarded > 0 && (
                          <span className="badge-success num">
                            {toFaDigits(m.team.result.pointsAwarded)} امتیاز
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- منو ---- */}
        <section className="card divide-y divide-brand-50 overflow-hidden">
          <MenuItem href="/wallet" icon="wallet" label="کیف پول" />
          <MenuItem href="/market" icon="ticket" label="فروشگاه باشگاه" />
          <MenuItem href="/market/orders" icon="receipt" label="سفارش‌های فروشگاه" />
          <MenuItem href="/news" icon="notification" label="اخبار باشگاه" />
          <MenuItem href="/bookings" icon="history" label="تاریخچه رزرو" />
          <MenuItem href="/wallet/transactions" icon="receipt" label="تراکنش‌های کیف پول" />
          <MenuItem href="/partner-requests" icon="partner" label="درخواست‌های پارتنری" />
          <MenuItem href="/notifications" icon="notification" label="اعلان‌ها" badge={unread} />
          <MenuItem href="/profile/settings" icon="settings" label="تنظیمات حساب" />
          {user.role === 'ADMIN' && <MenuItem href="/admin" icon="admin" label="پنل مدیریت" />}
        </section>

        <LogoutButton />
      </div>
    </>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="card p-3 text-center">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-4 w-4" strokeWidth={2.1} />
      </span>
      <p className="num mt-1 truncate text-sm font-black text-brand-800">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold text-brand-300">{label}</p>
    </div>
  );
}

function MenuItem({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: IconName;
  label: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="flex cursor-pointer items-center gap-3 p-4 transition hover:bg-brand-50/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="flex-1 text-xs font-extrabold text-brand-700">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-black text-on-accent">
          {toFaDigits(badge)}
        </span>
      )}
      <ChevronLeft className="h-4 w-4 shrink-0 text-brand-200" strokeWidth={2.4} aria-hidden="true" />
    </Link>
  );
}
