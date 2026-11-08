import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { deleteUserCompletely } from '@/lib/user-deletion';
import { AppError, handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* حذف هر کاربر چند کوئری دارد؛ برای صد نفر چند ثانیه طول می‌کشد */
export const maxDuration = 60;

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'هیچ کاربری انتخاب نشده است.').max(200, 'حداکثر ۲۰۰ کاربر در هر بار.'),
  /** کلمه‌ی تأیید — جلوی حذف ناخواسته را می‌گیرد */
  confirm: z.literal('حذف', { errorMap: () => ({ message: 'برای تأیید، کلمه‌ی «حذف» را بنویسید.' }) }),
});

/** حذف گروهی کاربران (مثلاً حساب‌های آزمایشی) — فقط مدیر کل */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = schema.parse(await req.json());
    if (input.ids.includes(admin.id)) throw new AppError('حساب خودتان در فهرست است.', 400);

    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of new Set(input.ids)) {
      try {
        const r = await deleteUserCompletely({ userId: id, actorId: admin.id });
        deleted.push(r.username);
      } catch (error) {
        failed.push({ id, error: error instanceof Error ? error.message : 'خطا' });
      }
    }
    return ok({ deleted, failed });
  } catch (error) {
    return handleApiError(error);
  }
}
