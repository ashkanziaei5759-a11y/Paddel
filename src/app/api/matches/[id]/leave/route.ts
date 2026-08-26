import { requireUser } from '@/lib/auth/rbac';
import { leaveMatch } from '@/lib/matches';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await leaveMatch({ userId: user.id, matchId: id });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
