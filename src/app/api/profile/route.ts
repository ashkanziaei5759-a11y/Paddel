import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { updateProfileSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const input = updateProfileSchema.parse(body);

    const profile = await prisma.profile.update({
      where: { userId: user.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });

    return ok({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}
