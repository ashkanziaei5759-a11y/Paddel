import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { toEnDigits } from '@/lib/datetime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * جست‌وجوی بازیکن برای رزرو تلفنی — با نام، نام خانوادگی، نام کاربری یا موبایل.
 * «علی رضایی» هر دو کلمه را جدا جست‌وجو می‌کند (هر کلمه باید در یکی از فیلدها باشد).
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const q = toEnDigits(new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
    if (q.length < 2) return ok({ players: [] });

    const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
    const where: Prisma.UserWhereInput = {
      role: 'PLAYER',
      status: 'ACTIVE',
      AND: words.map((w) => ({
        OR: [
          { username: { contains: w, mode: 'insensitive' } },
          { phone: { contains: w } },
          { profile: { firstName: { contains: w, mode: 'insensitive' } } },
          { profile: { lastName: { contains: w, mode: 'insensitive' } } },
        ],
      })),
    };

    const users = await prisma.user.findMany({
      where,
      take: 12,
      orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
      select: {
        id: true,
        username: true,
        phone: true,
        wallet: { select: { balance: true } },
        profile: { select: { firstName: true, lastName: true, avatarUrl: true, level: true } },
      },
    });

    return ok({
      players: users.map((u) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        name: `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim() || u.username,
        avatarUrl: u.profile?.avatarUrl ?? null,
        level: u.profile?.level ?? null,
        balance: (u.wallet?.balance ?? 0n).toString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
