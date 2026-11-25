import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { hashPassword } from '@/lib/auth/password';
import { AppError, handleApiError, ok } from '@/lib/api';
import { zPassword, zPersianName, zPhone, zUsername } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  firstName: zPersianName,
  lastName: zPersianName,
  username: zUsername,
  password: zPassword,
  phone: zPhone.optional().or(z.literal('').transform(() => undefined)),
});

/**
 * ساخت حساب ادمین پذیرش. فقط مدیر کل.
 * این حساب کیف پول ندارد و فقط به رزرو تلفنی و فهرست رزروها دسترسی دارد.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const input = createSchema.parse(await req.json());

    const taken = await prisma.user.findFirst({
      where: { OR: [{ username: input.username }, ...(input.phone ? [{ phone: input.phone }] : [])] },
      select: { username: true },
    });
    if (taken) {
      throw new AppError(
        taken.username === input.username ? 'این نام کاربری قبلاً گرفته شده است.' : 'این شماره موبایل به حساب دیگری متصل است.',
        409,
      );
    }

    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash: await hashPassword(input.password),
        role: 'STAFF',
        phone: input.phone ?? null,
        phoneVerifiedAt: input.phone ? new Date() : null,
        profile: { create: { firstName: input.firstName, lastName: input.lastName } },
      },
      select: { id: true, username: true },
    });
    return ok({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
