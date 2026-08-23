import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/rbac';
import { respondToPartnerRequest } from '@/lib/tournaments/registration';
import { handleApiError, ok } from '@/lib/api';
import { partnerRespondSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const input = partnerRespondSchema.parse(body);

    const result = await respondToPartnerRequest(id, user.id, input.action);

    return ok({
      status: result.request.status,
      teamId: result.team?.id ?? null,
      teamName: result.team?.name ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
