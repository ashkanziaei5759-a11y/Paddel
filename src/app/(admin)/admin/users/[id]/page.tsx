import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Avatar } from '@/components/ui/Avatar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { UserAdminPanel } from './UserAdminPanel';
import { formatNumber, formatToman, maskPhone } from '@/lib/utils';
import { formatDateTime, toFaDigits } from '@/lib/datetime';
import { BOOKING_STATUS_LABEL, POINTS_TX_LABEL, WALLET_TX_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'پروفایل کاربر' };
export const dynamic = 'force-dynamic';

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      wallet: true,
      bookings: {
        orderBy: { startsAt: 'desc' },
        take: 15,
        include: { court: { select: { name: true } } },
      },
      walletTxs: { orderBy: { createdAt: 'desc' }, take: 15 },
      pointsTxs: { orderBy: { createdAt: 'desc' }, take: 15 },
      teamMemberships: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { team: { include: { tournament: { select: { id: true, name: true } }, result: true } } },
      },
    },
  });

  if (!user || !user.profile) notFound();

  return (
    <>
      <AdminHeader
        title={`${user.profile.firstName} ${user.profile.lastName}`}
        subtitle={`@${user.username}`}
        action={
          <Link href="/admin/users" className="btn-outline btn-sm">
            بازگشت
          </Link>
        }
      />

      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-3 lg:px-8">
        {/* ---- ستون راست: اطلاعات و ابزار ---- */}
        <div className="space-y-4 lg:col-span-1">
          <section className="card-dark p-5">
            <div className="relative flex items-center gap-4">
              <Avatar
                firstName={user.profile.firstName}
                lastName={user.profile.lastName}
                src={user.profile.avatarUrl}
                size="lg"
                ring
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {user.profile.firstName} {user.profile.lastName}
                </p>
                <p className="num text-[11px] font-bold text-sky-light/70" dir="ltr">
                  @{user.username}
                </p>
                <div className="mt-2">
                  <LevelBadge level={user.profile.level} />
                </div>
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-3">
              <Cell label="شماره موبایل" value={user.phone ? maskPhone(user.phone) : '—'} />
              <Cell label="وضعیت" value={user.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'} />
              <Cell label="امتیاز" value={formatNumber(user.profile.points)} />
              <Cell label="کیف پول" value={formatToman(user.wallet?.balance ?? 0n)} />
              <Cell label="نقش" value={user.role === 'ADMIN' ? 'مدیر' : 'بازیکن'} />
              <Cell label="عضویت" value={formatDateTime(user.createdAt, { withWeekday: false })} />
            </div>
          </section>

          <UserAdminPanel
            userId={user.id}
            firstName={user.profile.firstName}
            lastName={user.profile.lastName}
            level={user.profile.level}
            role={user.role}
            status={user.status}
            balance={(user.wallet?.balance ?? 0n).toString()}
            points={user.profile.points}
          />
        </div>

        {/* ---- ستون چپ: سوابق ---- */}
        <div className="space-y-4 lg:col-span-2">
          <Section title="تاریخچه رزرو">
            {user.bookings.length === 0 ? (
              <Empty text="رزروی ثبت نشده است." />
            ) : (
              <div className="card divide-y divide-brand-50 overflow-hidden">
                {user.bookings.map((b) => (
                  <Link
                    key={b.id}
                    href={`/bookings/${b.id}`}
                    className="flex items-center gap-3 p-3.5 transition hover:bg-brand-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-brand-800">{b.court.name}</p>
                      <p className="num text-[10px] font-semibold text-brand-400">
                        {formatDateTime(b.startsAt, { withWeekday: false })} <Dot />
                        {b.code}
                      </p>
                    </div>
                    <span className="num text-[11px] font-bold text-brand-600">
                      {formatToman(b.totalPrice, { withUnit: false })}
                    </span>
                    <span className="badge-muted shrink-0">{BOOKING_STATUS_LABEL[b.status]}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="تراکنش‌های کیف پول">
            {user.walletTxs.length === 0 ? (
              <Empty text="تراکنشی ثبت نشده است." />
            ) : (
              <div className="card divide-y divide-brand-50 overflow-hidden">
                {user.walletTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-brand-800">
                        {tx.description || WALLET_TX_LABEL[tx.type]}
                      </p>
                      <p className="text-[10px] font-semibold text-brand-400">
                        {formatDateTime(tx.createdAt, { withWeekday: false })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'num shrink-0 text-xs font-black',
                        tx.amount > 0n ? 'text-success' : 'text-brand-700',
                      )}
                    >
                      {tx.amount > 0n ? '+' : '−'}
                      {formatToman(tx.amount < 0n ? -tx.amount : tx.amount, { withUnit: false })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="تاریخچه امتیاز">
            {user.pointsTxs.length === 0 ? (
              <Empty text="امتیازی ثبت نشده است." />
            ) : (
              <div className="card divide-y divide-brand-50 overflow-hidden">
                {user.pointsTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-brand-800">
                        {tx.description || POINTS_TX_LABEL[tx.type]}
                      </p>
                      <p className="text-[10px] font-semibold text-brand-400">
                        {formatDateTime(tx.createdAt, { withWeekday: false })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'num shrink-0 text-xs font-black',
                        tx.amount > 0 ? 'text-accent-500' : 'text-brand-400',
                      )}
                    >
                      {tx.amount > 0 ? '+' : '−'}
                      {toFaDigits(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="تورنومنت‌ها">
            {user.teamMemberships.length === 0 ? (
              <Empty text="در تورنومنتی شرکت نکرده است." />
            ) : (
              <div className="card divide-y divide-brand-50 overflow-hidden">
                {user.teamMemberships.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/tournaments/${m.team.tournament.id}`}
                    className="flex items-center gap-3 p-3.5 transition hover:bg-brand-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-brand-800">
                        {m.team.tournament.name}
                      </p>
                      <p className="truncate text-[10px] font-semibold text-brand-400">
                        تیم {m.team.name}
                      </p>
                    </div>
                    {m.team.result && (
                      <span className="badge-accent num shrink-0">
                        رتبه {toFaDigits(m.team.result.finalRank)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-sky-light/60">{label}</p>
      <p className="num mt-1 truncate text-[11px] font-black text-white">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-extrabold text-brand-800">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card px-6 py-8 text-center">
      <p className="text-xs font-bold text-brand-300">{text}</p>
    </div>
  );
}
