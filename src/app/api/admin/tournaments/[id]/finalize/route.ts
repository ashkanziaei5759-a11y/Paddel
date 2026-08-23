import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { finalizeTournament } from '@/lib/tournaments/results';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * پایان تورنومنت: تعیین رتبه‌ی نهایی و اعطای خودکار امتیاز به بازیکنان تیم‌های برتر.
 * اجرای دوباره امتیاز تکراری ایجاد نمی‌کند.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;

    const result = await finalizeTournament(id, admin.id);

    return ok({ ranking: result.ranking, awardedCount: result.awardedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
