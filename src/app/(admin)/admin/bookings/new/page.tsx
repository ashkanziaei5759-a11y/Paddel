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
            ? 'برای بازیکن عضو یا افراد متفرقه — کیف پول، کارت به کارت یا رایگان — یا به نام خود باشگاه'
            : 'بازیکن عضو یا افراد متفرقه — پرداخت از کیف پول یا کارت به کارت با شماره فیش'
        }
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <DeskBooking isAdmin={isAdmin} todayKey={dayKey(new Date())} />
      </div>
    </>
  );
}
