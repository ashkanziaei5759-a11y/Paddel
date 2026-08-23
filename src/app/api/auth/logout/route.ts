import { destroySession } from '@/lib/auth/session';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await destroySession();
    return ok({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
