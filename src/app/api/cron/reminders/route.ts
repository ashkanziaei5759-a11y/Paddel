import { NextRequest } from 'next/server';
import { runNotificationRules, schedulerToken } from '@/lib/notification-rules';
import { handleApiError, ok, AppError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * اجرای اعلان‌های خودکار (یادآوری بازی و قانون‌های پنل مدیریت).
 *
 * خودِ سرور هر دقیقه این مسیر را صدا می‌زند (src/instrumentation.ts)؛ روی
 * Vercel یا cron بیرونی هم می‌شود با CRON_SECRET صدایش زد. بدون توکن بسته است
 * وگرنه هر کسی می‌توانست با صدا زدن مکرر، اجرای قانون‌ها را جلو بیندازد.
 */
export async function GET(req: NextRequest) {
  try {
    const token = schedulerToken();
    if (!token) throw new AppError('زمان‌بند پیکربندی نشده است.', 503);

    const header = req.headers.get('authorization');
    if (header !== `Bearer ${token}`) throw new AppError('دسترسی ندارید.', 401);

    return ok(await runNotificationRules());
  } catch (error) {
    return handleApiError(error);
  }
}
