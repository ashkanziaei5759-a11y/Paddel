import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { notify, notifyMany } from '@/lib/notifications';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().trim().min(2, 'عنوان کوتاه است.').max(120),
  body: z.string().trim().min(2, 'متن پیام کوتاه است.').max(1000),
  /* یا برای یک نفر، یا برای همه‌ی بازیکنان فعال */
  audience: z.enum(['USER', 'ALL_PLAYERS']),
  userId: z.string().min(1).optional(),
});

/**
 * پیام مدیر به بازیکنان.
 *
 * ارسال همگانی می‌تواند هزاران ردیف بسازد، پس با سقف نرخ محدود شده است تا
 * یک اشتباه، صندوق اعلان همه را پر نکند.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const limit = await rateLimit(`admin-notify:${admin.id}`, 20, 3600);
    if (!limit.allowed) {
      throw new AppError('تعداد پیام‌های ارسالی در این ساعت زیاد بوده است.', 429);
    }

    const input = schema.parse(await req.json());

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
        actionUrl: '/notifications',
      });
      return ok({ sent: 1 });
    }

    const players = await prisma.user.findMany({
      where: { role: 'PLAYER', status: 'ACTIVE' },
      select: { id: true },
    });

    await notifyMany(
      players.map((p) => ({
        userId: p.id,
        type: 'ADMIN_MESSAGE' as const,
        title: input.title,
        body: input.body,
        actionUrl: '/notifications',
      })),
    );

    return ok({ sent: players.length });
  } catch (error) {
    return handleApiError(error);
  }
}
