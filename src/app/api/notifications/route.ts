import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { markAllRead, unreadCount } from '@/lib/notifications';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const onlyUnread = searchParams.get('unread') === '1';

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, ...(onlyUnread ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      unreadCount(user.id),
    ]);

    return ok({ notifications, unread });
  } catch (error) {
    return handleApiError(error);
  }
}

/** علامت‌گذاری همه به‌عنوان خوانده‌شده */
export async function POST() {
  try {
    const user = await requireUser();
    await markAllRead(user.id);
    return ok({ unread: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
