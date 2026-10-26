import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/rbac';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { toFaDigits } from '@/lib/datetime';
import { StaffManager } from './StaffManager';

export const metadata: Metadata = { title: 'ادمین‌های پذیرش' };
export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  await requireAdminPage();

  const staff = await prisma.user.findMany({
    where: { role: 'STAFF' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      profile: { select: { firstName: true, lastName: true } },
      _count: { select: { bookingsCreated: true } },
    },
  });

  return (
    <>
      <AdminHeader title="ادمین‌های پذیرش" subtitle={`${toFaDigits(staff.length)} حساب`} />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <StaffManager
          staff={staff.map((s) => ({
            id: s.id,
            username: s.username,
            phone: s.phone,
            name: `${s.profile?.firstName ?? ''} ${s.profile?.lastName ?? ''}`.trim(),
            active: s.status === 'ACTIVE',
            lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
            bookings: s._count.bookingsCreated,
          }))}
        />
      </div>
    </>
  );
}
