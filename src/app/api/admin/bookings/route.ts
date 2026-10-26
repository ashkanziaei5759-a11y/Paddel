import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/rbac';
import { createBooking } from '@/lib/booking';
import { rateLimit } from '@/lib/rate-limit';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  courtId: z.string().min(1, 'زمین را انتخاب کنید.'),
  slots: z
    .array(z.string().datetime({ offset: true }))
    .min(1, 'حداقل یک سانس انتخاب کنید.')
    .max(16, 'تعداد سانس‌ها بیش از حد مجاز است.'),
  /**
   * WALLET: برای بازیکن، از کیف پولش کسر می‌شود.
   * FREE:   برای بازیکن، بدون پرداخت (فقط مدیر کل).
   * CLUB:   به نام خود مدیریت، بدون پرداخت و بدون محدودیت (فقط مدیر کل).
   */
  mode: z.enum(['WALLET', 'FREE', 'CLUB']),
  userId: z.string().min(1).optional(),
  notes: z.string().trim().max(240).optional(),
});

/** رزرو تلفنی: ادمین برای بازیکنی که تماس گرفته زمین می‌گیرد */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireStaff();
    const limited = await rateLimit(`desk-booking:${actor.id}`, 60, 10 * 60);
    if (!limited.allowed) throw new AppError('تعداد رزروها در چند دقیقه‌ی اخیر زیاد بوده است.', 429);

    const input = schema.parse(await req.json());
    const isAdmin = actor.role === 'ADMIN';

    if (!isAdmin && input.mode !== 'WALLET') {
      throw new AppError('رزرو رایگان فقط با دسترسی مدیر کل ممکن است.', 403);
    }

    let userId = actor.id;
    if (input.mode !== 'CLUB') {
      if (!input.userId) throw new AppError('بازیکن را انتخاب کنید.', 400);
      const player = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true, status: true },
      });
      if (!player || player.role !== 'PLAYER') throw new AppError('بازیکن پیدا نشد.', 404);
      if (player.status !== 'ACTIVE') throw new AppError('حساب این بازیکن غیرفعال است.', 409);
      userId = player.id;
    }

    const starts = input.slots.map((s) => new Date(s));

    /* ادمین پذیرش «فاصله تا شروع» را ندارد (بازیکن پشت تلفن است)، ولی سانسِ
       گذشته و بازه‌ای که باشگاه مسدود کرده فقط با مدیر کل گرفته می‌شود. */
    if (!isAdmin) {
      const now = Date.now();
      if (starts.some((s) => s.getTime() <= now)) throw new AppError('سانس گذشته را نمی‌توان رزرو کرد.', 400);
      const first = Math.min(...starts.map((s) => s.getTime()));
      const last = Math.max(...starts.map((s) => s.getTime()));
      const court = await prisma.court.findUnique({ where: { id: input.courtId }, select: { slotDurationMinutes: true } });
      if (court) {
        const blackout = await prisma.courtBlackout.findFirst({
          where: {
            courtId: input.courtId,
            startsAt: { lt: new Date(last + court.slotDurationMinutes * 60_000) },
            endsAt: { gt: new Date(first) },
          },
          select: { id: true },
        });
        if (blackout) throw new AppError('این بازه توسط باشگاه مسدود شده است.', 409);
      }
    }

    const booking = await createBooking({
      userId,
      courtId: input.courtId,
      slotStarts: starts,
      source: 'ADMIN',
      notes: input.notes,
      performedBy: actor.id,
      createdById: actor.id,
      skipPayment: input.mode !== 'WALLET',
      silent: input.mode === 'CLUB',
    });

    return ok({ id: booking.id, code: booking.code, totalPrice: booking.totalPrice.toString() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
