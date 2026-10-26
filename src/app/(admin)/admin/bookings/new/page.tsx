import type { Metadata } from 'next';
import { requireStaffPage } from '@/lib/auth/rbac';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { dayKey } from '@/lib/datetime';
import { DeskBooking } from './DeskBooking';

export const metadata: Metadata = { title: 'رزرو تلفنی' };
export const dynamic = 'force-dynamic';

export default async function DeskBookingPage() {
  const user = await requireStaffPage();
  const isAdmin = user.role === 'ADMIN';

  return (
    <>
      <AdminHeader
        title="رزرو تلفنی"
        subtitle={
          isAdmin
            ? 'برای بازیکن (از کیف پولش یا رایگان) یا به نام خود باشگاه — بدون محدودیت'
            : 'بازیکن را پیدا کنید، سانس را انتخاب کنید؛ مبلغ از کیف پول بازیکن کسر می‌شود'
        }
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <DeskBooking isAdmin={isAdmin} todayKey={dayKey(new Date())} />
      </div>
    </>
  );
}
