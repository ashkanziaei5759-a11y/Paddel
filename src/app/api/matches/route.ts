import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { createOpenMatch } from '@/lib/matches';
import { handleApiError, ok } from '@/lib/api';
import { openMatchCreateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** بازی‌های بازی که هنوز شروع نشده‌اند */
export async function GET() {
  try {
    await requireUser();

    const matches = await prisma.openMatch.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        booking: { status: 'CONFIRMED', startsAt: { gt: new Date() } },
      },
      include: {
        booking: { include: { court: { select: { name: true } } } },
        players: { include: { user: { include: { profile: true } } } },
      },
      orderBy: { booking: { startsAt: 'asc' } },
      take: 60,
    });

    return ok({ matches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = openMatchCreateSchema.parse(await req.json());

    const match = await createOpenMatch({
      userId: user.id,
      bookingId: input.bookingId,
      capacity: input.capacity,
      levelPolicy: input.levelPolicy,
      allowedLevels: input.allowedLevels,
      notes: input.notes,
    });

    return ok(match, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
