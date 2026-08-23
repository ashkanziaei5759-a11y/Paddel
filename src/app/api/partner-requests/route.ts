import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { sendPartnerRequest } from '@/lib/tournaments/registration';
import { handleApiError, ok } from '@/lib/api';
import { partnerRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();

    const [incoming, outgoing] = await Promise.all([
      prisma.partnerRequest.findMany({
        where: { receiverId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          tournament: { select: { id: true, name: true, startsAt: true } },
          sender: { include: { profile: true } },
        },
      }),
      prisma.partnerRequest.findMany({
        where: { senderId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          tournament: { select: { id: true, name: true, startsAt: true } },
          receiver: { include: { profile: true } },
        },
      }),
    ]);

    return ok({ incoming, outgoing });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = partnerRequestSchema.parse(body);

    const request = await sendPartnerRequest({
      tournamentId: input.tournamentId,
      senderId: user.id,
      receiverUsername: input.receiverUsername,
      message: input.message,
    });

    return ok({ id: request.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
