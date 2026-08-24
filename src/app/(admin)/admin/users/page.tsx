import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Avatar } from '@/components/ui/Avatar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { UserSearch } from './UserSearch';
import { formatNumber, formatToman, maskPhone } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = { title: 'مدیریت کاربران' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; role?: string }>;
}) {
  const { q, level, role } = await searchParams;
  const query = q?.trim();

  const users = await prisma.user.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' as const } },
              { phone: { contains: query } },
              { profile: { firstName: { contains: query, mode: 'insensitive' as const } } },
              { profile: { lastName: { contains: query, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
      ...(role === 'ADMIN' || role === 'PLAYER' ? { role } : {}),
      ...(level ? { profile: { level: level as never } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      profile: true,
      wallet: { select: { balance: true } },
      _count: { select: { bookings: true } },
    },
  });

  return (
    <>
      <AdminHeader
        title="مدیریت کاربران"
        subtitle={`${toFaDigits(users.length)} کاربر نمایش داده شده`}
      />

      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <UserSearch defaultQuery={query ?? ''} defaultLevel={level ?? ''} defaultRole={role ?? ''} />

        {users.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="text-xs font-bold text-brand-300">کاربری با این مشخصات یافت نشد.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {users.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="card-interactive block p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    firstName={u.profile?.firstName ?? '؟'}
                    lastName={u.profile?.lastName ?? ''}
                    src={u.profile?.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-extrabold text-brand-800">
                        {u.profile?.firstName} {u.profile?.lastName}
                      </p>
                      {u.role === 'ADMIN' && <span className="badge-brand shrink-0">مدیر</span>}
                      {u.status === 'SUSPENDED' && (
                        <span className="badge-danger shrink-0">غیرفعال</span>
                      )}
                    </div>
                    <p className="num truncate text-[10px] font-bold text-brand-300" dir="ltr">
                      @{u.username}
                    </p>
                    <p className="num mt-0.5 text-[10px] font-semibold text-brand-400" dir="ltr">
                      {u.phone ? maskPhone(u.phone) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  {u.profile && <LevelBadge level={u.profile.level} size="sm" />}
                  <div className="flex items-center gap-3 text-[10px] font-bold text-brand-400">
                    <span className="num flex items-center gap-1">
                      <Icon name="points" className="h-3.5 w-3.5" strokeWidth={2.2} />
                      {formatNumber(u.profile?.points ?? 0)}
                    </span>
                    <span className="num flex items-center gap-1">
                      <Icon name="booking" className="h-3.5 w-3.5" strokeWidth={2.2} />
                      {toFaDigits(u._count.bookings)}
                    </span>
                    <span className="num text-brand-600">
                      {formatToman(u.wallet?.balance ?? 0n, { withUnit: false })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
