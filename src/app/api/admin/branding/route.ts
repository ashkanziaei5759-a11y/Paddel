import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { AppError, handleApiError, ok } from "@/lib/api";
import {
  BRANDING_KEY,
  DEFAULT_BRANDING,
  isSafeBrandingUrl,
  type Branding,
} from "@/lib/branding";

const FIELDS = Object.keys(DEFAULT_BRANDING) as (keyof Branding)[];

/**
 * تغییر لوگو، آیکون اپ و پوستر صفحه‌ی ورود.
 *
 * فقط مدیر. مقدار هر کلید یا نشانی یکی از تصویرهای خودمان است یا null
 * (بازگشت به فایل پیش‌فرض). هر چیز دیگری رد می‌شود تا کسی نتواند نشانی
 * بیرونی یا javascript: را در برندینگ بنشاند.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin();

    const limit = await rateLimit(`branding:${user.id}`, 60, 3600);
    if (!limit.allowed) {
      throw new AppError(
        "تعداد تغییرها در این ساعت زیاد بوده است. کمی بعد دوباره تلاش کنید.",
        429,
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object")
      throw new AppError("داده‌ی نامعتبر است.", 400);

    const patch: Record<string, string | null> = {};
    for (const field of FIELDS) {
      if (!(field in body)) continue;
      const value = (body as Record<string, unknown>)[field];
      if (value === null || value === "") {
        patch[field] = null;
        continue;
      }
      if (!isSafeBrandingUrl(value)) {
        throw new AppError("نشانی تصویر معتبر نیست.", 400);
      }
      patch[field] = value;
    }
    if (Object.keys(patch).length === 0)
      throw new AppError("چیزی برای تغییر نیست.", 400);

    const existing = await prisma.appSetting.findUnique({
      where: { key: BRANDING_KEY },
    });
    const before: Record<string, string> = {};
    if (
      existing?.value &&
      typeof existing.value === "object" &&
      !Array.isArray(existing.value)
    ) {
      for (const [key, value] of Object.entries(existing.value)) {
        if (typeof value === "string") before[key] = value;
      }
    }

    const next: Record<string, string> = {};
    for (const field of FIELDS) {
      const value = field in patch ? patch[field] : before[field];
      if (isSafeBrandingUrl(value)) next[field] = value;
    }

    await prisma.appSetting.upsert({
      where: { key: BRANDING_KEY },
      create: {
        key: BRANDING_KEY,
        value: next,
        description: "لوگو، آیکون اپ و پوستر صفحه‌ی ورود",
        updatedBy: user.id,
      },
      update: { value: next, updatedBy: user.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ADMIN_UPDATE_BRANDING",
        entityType: "AppSetting",
        entityId: BRANDING_KEY,
        before,
        after: next,
      },
    });

    return ok(next);
  } catch (error) {
    return handleApiError(error);
  }
}
