import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { generateSchedule } from '@/lib/tournaments/schedule';
import { recomputeStandings, populateKnockout } from '@/lib/tournaments/standings';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * ساخت جدول مسابقات.
 * action=generate  → ساخت کامل برنامه (نتایج قبلی پاک می‌شود)
 * action=advance   → انتقال صعودکنندگان گروه‌ها به براکت حذفی
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'generate';

    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new AppError('تورنومنت یافت نشد.', 404);

    if (action === 'advance') {
      await recomputeStandings(id);
      await populateKnockout(id);
      return ok({ advanced: true });
    }

    const matchCount = await generateSchedule(id);
    await recomputeStandings(id);

    return ok({ matchCount });
  } catch (error) {
    return handleApiError(error);
  }
}
