-- بنرهای نمونه‌ی قبلی (هنوز با عکس‌های پیش‌فرض) به بنرهای برند پرشین پدل تغییر می‌کنند.
-- بنرهایی که مدیر خودش ساخته یا عکسشان را عوض کرده، دست نمی‌خورند.
UPDATE "banners" SET "imageUrl" = '/images/banners/banner-tournament.jpg', "title" = 'جام پرشین پدل'
WHERE "title" = 'جام تابستانه پرشین پدل' AND "imageUrl" = '/images/login/court-1.jpg';

UPDATE "banners" SET "imageUrl" = '/images/banners/banner-store.jpg', "title" = 'فروشگاه باشگاه'
WHERE "title" = 'فروشگاه باشگاه راه‌اندازی شد' AND "imageUrl" = '/images/login/court-3.jpg';

UPDATE "banners" SET "imageUrl" = '/images/banners/banner-club.jpg'
WHERE "title" = 'ساعات پرتقاضا رزرو کنید' AND "imageUrl" = '/images/login/court-2.jpg';
