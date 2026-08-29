import type { Metadata } from 'next';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { unreadCount } from '@/lib/notifications';
import { SettingsForms } from './SettingsForms';

export const metadata: Metadata = { title: 'تنظیمات حساب' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requirePage();
  const [profile, unread] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    unreadCount(user.id),
  ]);

  return (
    <>
      <TopBar title="تنظیمات حساب" subtitle="ویرایش اطلاعات شخصی" unread={unread} back="/profile" />
      <div className="page-pad pt-2">
        <SettingsForms
          firstName={user.firstName}
          lastName={user.lastName}
          bio={profile?.bio ?? ''}
          avatarUrl={user.avatarUrl ?? ''}
          phone={user.phone ?? ""}
          gender={profile?.gender ?? null}
        />
      </div>
    </>
  );
}
