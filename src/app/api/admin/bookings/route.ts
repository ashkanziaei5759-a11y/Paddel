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
   * CARD_TO_CARD: مشتری کارت به کارت کرده؛ از کیف پول چیزی کم نمی‌شود و
   *         مبلغ واریزی و شماره‌ی فیش ثبت می‌شود (پذیرش و مدیر کل).
   */
  mode: z.enum(['WALLET', 'FREE', 'CLUB', 'CARD_TO_CARD']),
  /** PLAYER: بازیکن ثبت‌نام‌شده (userId) — GUEST: مشتری متفرقه بدون حساب (guestName) */
  customer: z.enum(['PLAYER', 'GUEST']).default('PLAYER'),
  userId: z.string().min(1).optional(),
  guestName: z
    .string()
    .trim()
    .min(2, 'نام مشتری را وارد کنید.')
    .max(60, 'نام مشتری بیش از حد طولانی است.')
    .optional(),
  guestPhone: z
    .string()
    .trim()
    .regex(/^[0-9۰-۹+\-\s]{0,20}$/, 'شماره تماس نامعتبر است.')
    .optional(),
  /** مبلغ کارت به کارت به تومان */
  cardAmountToman: z
    .number({ invalid_type_error: 'مبلغ کارت به کارت را وارد کنید.' })
    .int('مبلغ باید عدد صحیح باشد.')
    .positive('مبلغ کارت به کارت را وارد کنید.')
    .max(10_000_000_000, 'مبلغ کارت به کارت بیش از حد است.')
    .optional(),
  receiptNumber: z
    .string()
    .trim()
    .min(3, 'شماره فیش را وارد کنید.')
    .max(40, 'شماره فیش بیش از حد طولانی است.')
    .optional(),
  notes: z.string().trim().max(240).optional(),
});

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** ارقام فارسی/عربی را لاتین می‌کند تا شماره‌ی فیش یکسان ذخیره و جست‌وجو شود */
function latinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = FA_DIGITS.indexOf(d);
    return String(i >= 0 ? i : AR_DIGITS.indexOf(d));
  });
}

/** رزرو تلفنی: ادمین برای بازیکنی که تماس گرفته زمین می‌گیرد */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireStaff();
    const limited = await rateLimit(`desk-booking:${actor.id}`, 60, 10 * 60);
    if (!limited.allowed) throw new AppError('تعداد رزروها در چند دقیقه‌ی اخیر زیاد بوده است.', 429);

    const input = schema.parse(await req.json());
    const isAdmin = actor.role === 'ADMIN';

    if (!isAdmin && (input.mode === 'FREE' || input.mode === 'CLUB')) {
      throw new AppError('رزرو رایگان فقط با دسترسی مدیر کل ممکن است.', 403);
    }

    const isGuest = input.mode !== 'CLUB' && input.customer === 'GUEST';
    if (isGuest && input.mode === 'WALLET') {
      throw new AppError('مشتری متفرقه کیف پول ندارد؛ کارت به کارت را انتخاب کنید.', 400);
    }
    if (isGuest && !input.guestName) throw new AppError('نام مشتری را وارد کنید.', 400);

    let cardToCard: { amount: bigint; receipt: string } | undefined;
    if (input.mode === 'CARD_TO_CARD') {
      if (!input.cardAmountToman) throw new AppError('مبلغ کارت به کارت را وارد کنید.', 400);
      if (!input.receiptNumber) throw new AppError('شماره فیش را وارد کنید.', 400);
      const receipt = latinDigits(input.receiptNumber).replace(/\s+/g, '');
      /* یک فیش فقط یک بار: جلوی ثبت دوباره‌ی همان واریز برای دو رزرو را می‌گیرد */
      const reused = await prisma.booking.findFirst({
        where: { cardReceipt: receipt, status: { not: 'CANCELLED' } },
        select: { code: true },
      });
      if (reused) {
        throw new AppError(`این شماره فیش قبلاً برای رزرو ${reused.code} ثبت شده است.`, 409);
      }
      cardToCard = { amount: BigInt(input.cardAmountToman) * 10n, receipt };
    }

    let userId: string | null = actor.id;
    if (isGuest) {
      userId = null;
    } else if (input.mode !== 'CLUB') {
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
      guest: isGuest
        ? { name: input.guestName!, phone: input.guestPhone ? latinDigits(input.guestPhone) : undefined }
        : undefined,
      cardToCard,
      courtId: input.courtId,
      slotStarts: starts,
      source: 'ADMIN',
      notes: input.notes,
      performedBy: actor.id,
      createdById: actor.id,
      skipPayment: input.mode === 'FREE' || input.mode === 'CLUB',
      silent: input.mode === 'CLUB',
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'DESK_BOOKING',
        entityType: 'Booking',
        entityId: booking.id,
        after: {
          code: booking.code,
          mode: input.mode,
          guest: isGuest ? input.guestName : undefined,
          cardAmount: cardToCard?.amount.toString(),
          receipt: cardToCard?.receipt,
        },
      },
    });

    return ok({ id: booking.id, code: booking.code, totalPrice: booking.totalPrice.toString() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
