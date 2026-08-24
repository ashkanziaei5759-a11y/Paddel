import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/rbac';
import { cancelOrder } from '@/lib/store';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await cancelOrder(id, user.id, user.role === 'ADMIN');
    return ok({ cancelled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
