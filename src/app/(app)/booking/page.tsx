import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { unreadCount } from '@/lib/notifications';
import { dayKey } from '@/lib/datetime';

export const metadata: Metadata = { title: 'رزرو زمین' };
export const dynamic = 'force-dynamic';

export default async function BookingPage() {
  const user = await requirePage();

  const [courts, wallet, unread] = await Promise.all([
    prisma.court.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
    unreadCount(user.id),
  ]);

  if (courts.length === 0) {
    return (
      <>
        <TopBar title="رزرو زمین" subtitle="انتخاب تاریخ و ساعت" unread={unread} />
        <div className="page-pad pt-2">
          <EmptyState
            icon="🏟"
            title="زمین فعالی وجود ندارد"
            description="در حال حاضر زمینی برای رزرو در دسترس نیست. لطفاً بعداً مراجعه کنید."
          />
        </div>
      </>
    );
  }

  const maxAdvanceDays = Math.max(...courts.map((c) => c.advanceBookingDays));

  return (
    <>
      <TopBar title="رزرو زمین" subtitle="تاریخ، زمین و ساعت را انتخاب کنید" unread={unread} />
      <div className="page-pad pt-2">
        <BookingFlow
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            slotDurationMinutes: c.slotDurationMinutes,
            maxConsecutiveSlots: c.maxConsecutiveSlots,
            basePrice: c.basePrice.toString(),
          }))}
          todayKey={dayKey(new Date())}
          balance={(wallet?.balance ?? 0n).toString()}
          maxAdvanceDays={maxAdvanceDays}
        />
      </div>
    </>
  );
}
