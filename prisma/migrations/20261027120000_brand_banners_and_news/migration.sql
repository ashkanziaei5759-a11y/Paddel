-- ۱. بنرهای آزمایشیِ نسخه‌های قبل حذف می‌شوند (فقط همان‌هایی که با عکس‌های پیش‌فرض ساخته شده بودند).
DELETE FROM "banners"
WHERE "title" IN ('جام تابستانه پرشین پدل', 'فروشگاه باشگاه راه‌اندازی شد', 'ساعات پرتقاضا رزرو کنید',
                  'جام پرشین پدل', 'فروشگاه باشگاه')
  AND "imageUrl" IN ('/images/login/court-1.jpg', '/images/login/court-2.jpg', '/images/login/court-3.jpg',
                     '/images/banners/banner-tournament.jpg', '/images/banners/banner-store.jpg',
                     '/images/banners/banner-club.jpg');

-- ۲. بنرهای برند پرشین پدل (اگر قبلاً اضافه نشده باشند)
INSERT INTO "banners" ("id", "title", "subtitle", "imageUrl", "linkUrl", "sortOrder", "isActive", "updatedAt")
SELECT v.id, v.title, v.subtitle, v.image, v.link, v.sort, true, CURRENT_TIMESTAMP
FROM (VALUES
  ('banner_brand_club',       'به پرشین پدل خوش آمدید', 'زمین موردعلاقه‌تان را آنلاین و در چند ثانیه رزرو کنید.',      '/images/banners/banner-club.jpg',       '/booking',     0),
  ('banner_brand_tournament', 'جام پرشین پدل',          'ثبت‌نام باز است — تیم خود را بسازید و برای قهرمانی بجنگید.', '/images/banners/banner-tournament.jpg', '/tournaments', 1),
  ('banner_brand_matches',    'بازی‌های باز را ببینید',  'هم‌بازی پیدا کنید و به بازی‌های امروز بپیوندید.',             '/images/banners/banner-matches.jpg',    '/matches',     2),
  ('banner_brand_store',      'فروشگاه باشگاه',         'راکت، توپ و لوازم ورزشی را با امتیاز یا از کیف پول بخرید.',   '/images/banners/banner-store.jpg',      '/market',      3)
) AS v(id, title, subtitle, image, link, sort)
WHERE NOT EXISTS (SELECT 1 FROM "banners" b WHERE b."imageUrl" = v.image);

-- ۳. خبر: رونمایی از هویت بصری جدید
INSERT INTO "articles" ("id", "slug", "title", "excerpt", "body", "coverUrl", "status", "publishedAt", "isPinned", "updatedAt")
VALUES (
  'article_brand_identity',
  'رونمایی-هویت-بصری-پرشین-پدل',
  'رونمایی از هویت بصری تازه‌ی پرشین پدل',
  'لوگو و رنگ‌های تازه‌ی باشگاه رونمایی شد؛ آبی برای ثبات و اعتماد، زرد توپ برای انرژی و هیجان.',
  'پرشین پدل با هویت بصری تازه به استقبال فصل جدید می‌رود.

**لوگو.** فرم لوگو برگرفته از حرکات دینامیک و پویای بازیکن در حین بازی پدل است؛ حرکاتی که پر از جست‌وخیز و انرژی‌اند. خطوط مینیمال و مدرنِ آن، جوهره‌ی حرکت، هیجان و پویایی این ورزش را به تصویر می‌کشد و ترکیب تعادل، تنش و حرکت در طراحی، نمایانگر روح رقابت، سرعت و دقت است.

**رنگ‌ها.** آبی، رنگ اصلی برند، نماد ثبات و اعتماد به نفس است و زرد توپ پدل، نماد انرژی و تحرک.

**اپ باشگاه هم تازه شد.** ظاهر اپ با همین رنگ‌ها و لوگو بازطراحی شده است. رزرو زمین، کیف پول، تورنومنت‌ها و فروشگاه مثل قبل در دسترس‌اند — فقط زیباتر.

منتظر دیدنتان در زمین هستیم!',
  '/images/banners/banner-club.jpg',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

-- خبر تازه بالای فهرست بماند
UPDATE "articles" SET "isPinned" = false WHERE "slug" = 'گزارش-فینال-جام-تابستانه';
