import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { broadcast, notify } from '@/lib/notifications';
import { AppError, handleApiError, ok } from '@/lib/api';
import { adminNotifySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * پیام مدیر به بازیکنان — روی صندوق اعلان و گوشی‌شان.
 *
 * می‌تواند تصویر (بنر/خبر) و لینک داشته باشد، و پیام همگانی را می‌شود برای
 * زمان مشخصی زمان‌بندی کرد (یک قانون «زمان‌دار» ساخته می‌شود).
 * ارسال همگانی هزاران ردیف می‌سازد، پس با سقف نرخ محدود شده است.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const limit = await rateLimit(`admin-notify:${admin.id}`, 20, 3600);
    if (!limit.allowed) {
      throw new AppError('تعداد پیام‌های ارسالی در این ساعت زیاد بوده است.', 429);
    }

    const input = adminNotifySchema.parse(await req.json());

    if (input.audience === 'USER') {
      if (!input.userId) throw new AppError('بازیکن را انتخاب کنید.', 400);
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!target) throw new AppError('بازیکن پیدا نشد.', 404);

      await notify({
        userId: target.id,
        type: 'ADMIN_MESSAGE',
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? '/notifications',
        imageUrl: input.imageUrl,
      });
      return ok({ sent: 1 });
    }

    if (input.scheduleAt) {
      const runAt = new Date(input.scheduleAt);
      if (runAt.getTime() < Date.now() - 60_000) throw new AppError('زمان ارسال گذشته است.', 400);
      await prisma.notificationRule.create({
        data: {
          name: `اطلاعیه: ${input.title}`.slice(0, 80),
          trigger: 'SCHEDULED',
          runAt,
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl ?? null,
          imageUrl: input.imageUrl ?? null,
          createdById: admin.id,
        },
      });
      return ok({ scheduled: runAt.toISOString() });
    }

    const players = await prisma.user.findMany({
      where: { role: 'PLAYER', status: 'ACTIVE' },
      select: { id: true },
    });

    const sent = await broadcast({
      userIds: players.map((p) => p.id),
      type: input.imageUrl ? 'CLUB_NEWS' : 'ADMIN_MESSAGE',
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl ?? '/notifications',
      imageUrl: input.imageUrl,
    });

    return ok({ sent });
  } catch (error) {
    return handleApiError(error);
  }
}
