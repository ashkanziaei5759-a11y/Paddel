import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * برندینگ اپ — لوگو، آیکون‌ها و پوستر صفحه‌ی ورود.
 *
 * این‌ها در جدول app_settings می‌نشینند و از پنل مدیریت عوض می‌شوند، بنابراین
 * برای تعویض لوگو نیازی به دیپلوی دوباره نیست. اگر کلیدی خالی باشد، فایل
 * ثابتِ داخل public/ استفاده می‌شود؛ پس اپ بدون هیچ تنظیمی هم کار می‌کند.
 */
export const BRANDING_KEY = "branding";

export interface Branding {
  /** لوگوی گردِ داخل اپ */
  logoUrl: string;
  /** پوستر صفحه‌ی ورود روی گوشی — عمودی (۹:۱۶) */
  loginPosterUrl: string;
  /** پوستر صفحه‌ی ورود روی لپ‌تاپ — افقی (۱۶:۹) */
  loginPosterWideUrl: string;
  /** آیکون اپ روی صفحه‌ی خانه‌ی موبایل و در manifest */
  iconUrl: string;
  /** آیکون maskable اندروید — حاشیه‌ی امن دارد */
  maskableIconUrl: string;
}

/** وقتی مدیر هنوز چیزی آپلود نکرده است */
export const DEFAULT_BRANDING: Branding = {
  logoUrl: "/icons/logo-256.png",
  loginPosterUrl: "/images/login/poster.jpg",
  loginPosterWideUrl: "/images/login/poster.jpg",
  iconUrl: "/icons/icon-512.png",
  maskableIconUrl: "/icons/maskable-512.png",
};

const FIELDS = Object.keys(DEFAULT_BRANDING) as (keyof Branding)[];

/** تنها مسیرهای ثابتی که پذیرفته می‌شوند */
const DEFAULT_PATHS = new Set<string>(Object.values(DEFAULT_BRANDING));

/**
 * فقط نشانی‌های داخلیِ خودمان پذیرفته می‌شوند. اگر مقدار ذخیره‌شده هر چیز
 * دیگری باشد — لینک بیرونی، javascript: یا آشغال — نادیده گرفته و به فایل
 * پیش‌فرض برمی‌گردیم؛ وگرنه یک ردیف دستکاری‌شده در دیتابیس می‌توانست منبع
 * تصویر صفحه‌ی ورود را به سایت دیگری ببرد.
 */
export function isSafeBrandingUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  /* تصویری که خودمان در پایگاه داده گذاشته‌ایم */
  if (/^\/api\/media\/[a-z0-9]+$/i.test(value)) return true;
  /* یا دقیقاً یکی از فایل‌های پیش‌فرض — نه هر مسیری زیر public/، وگرنه
     «..» می‌توانست به فایل دیگری روی سرور اشاره کند */
  return DEFAULT_PATHS.has(value);
}

export const getBranding = cache(async (): Promise<Branding> => {
  let stored: Record<string, unknown> = {};
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: BRANDING_KEY },
    });
    if (
      row?.value &&
      typeof row.value === "object" &&
      !Array.isArray(row.value)
    ) {
      stored = row.value as Record<string, unknown>;
    }
  } catch {
    /* دیتابیس در دسترس نیست — با پیش‌فرض‌ها ادامه بده تا صفحه بالا بیاید */
  }

  const result = { ...DEFAULT_BRANDING };
  for (const field of FIELDS) {
    const value = stored[field];
    if (isSafeBrandingUrl(value)) result[field] = value;
  }
  return result;
});
