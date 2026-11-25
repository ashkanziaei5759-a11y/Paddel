import { requireUser } from '@/lib/auth/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { sendPush } from '@/lib/push';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * اعلان آزمایشی به گوشی‌های خود کاربر. برخلاف اعلان‌های معمولی منتظر جواب
 * می‌ماند تا اگر سرور به سرویس اعلان گوگل/اپل دسترسی ندارد، همین‌جا معلوم شود.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const limit = await rateLimit(`push-test:${user.id}`, 5, 600);
    if (!limit.allowed) throw new AppError('کمی بعد دوباره امتحان کنید.', 429);

    const result = await sendPush([user.id], {
      title: 'اعلان‌ها روشن است ✅',
      body: 'از این به بعد یادآوری بازی و پیام‌های باشگاه روی گوشی‌تان می‌آید.',
      url: '/notifications',
      tag: 'push-test',
    });
    if (result.sent === 0 && result.failed > 0) {
      throw new AppError('سرور نتوانست اعلان را بفرستد. به مدیر باشگاه اطلاع دهید.', 502);
    }
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
