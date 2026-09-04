import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/rbac';
import { approveMatchPlayer, rejectMatchPlayer } from '@/lib/matches';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * تصمیم میزبان درباره‌ی یک درخواست پیوستن.
 *
 * مالکیت بازی داخل خود تراکنش بررسی می‌شود، نه اینجا؛ پس حتی اگر دو درخواست
 * هم‌زمان برسند، تنها میزبان واقعی می‌تواند تغییری بدهد.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const host = await requireUser();
    const { id, userId } = await params;

    const body = await req.json().catch(() => null);
    const action = (body as { action?: unknown } | null)?.action;
    if (action !== 'APPROVE' && action !== 'REJECT') {
      throw new AppError('عملیات نامعتبر است.', 400);
    }

    const input = { matchId: id, hostId: host.id, playerUserId: userId };
    const result =
      action === 'APPROVE' ? await approveMatchPlayer(input) : await rejectMatchPlayer(input);

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
