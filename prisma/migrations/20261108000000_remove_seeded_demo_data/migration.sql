-- حذف داده‌ی نمایشیِ نسخه‌های قبل (بازیکنان نمونه، تورنومنت و خبرهای ساختگی).
-- فقط حساب‌هایی حذف می‌شوند که هم نام کاربری و هم شماره‌ی موبایلشان دقیقاً همان
-- مقدار ساختگیِ seed است؛ هیچ بازیکن واقعی نمی‌تواند با هر دو جور دربیاید.

CREATE TEMP TABLE "_demo_users" AS
SELECT u."id" FROM "users" u
WHERE (u."username", u."phone") IN (
  ('ali', '09121111111'), ('sara', '09122222222'), ('reza', '09123333333'),
  ('niloofar', '09124444444'), ('mohammad', '09125555555'), ('mina', '09126666666'),
  ('amir', '09127777777'), ('zahra', '09128888888')
) AND u."role" = 'PLAYER';

-- اگر بازیکن واقعی در بازیِ بازِ فعالِ یکی از این حساب‌ها سهم پرداخته، آن حساب
-- این‌جا حذف نمی‌شود (پاک کردن بازی، سهم او را از بین می‌برد). مدیر می‌تواند از
-- پنل حذفش کند؛ آن‌جا اول بازی لغو و سهم‌ها برگردانده می‌شود.
DELETE FROM "_demo_users" d
WHERE EXISTS (
  SELECT 1 FROM "open_matches" m
  JOIN "open_match_players" p ON p."matchId" = m."id"
  WHERE m."hostId" = d."id"
    AND m."status" IN ('OPEN', 'FULL')
    AND p."userId" NOT IN (SELECT "id" FROM "_demo_users")
);

-- ثبت‌نام‌های تورنومنتی که این حساب‌ها ساخته‌اند به نام اولین مدیر منتقل می‌شود
UPDATE "tournament_registrations" SET "createdById" = (
  SELECT "id" FROM "users" WHERE "role" = 'ADMIN' ORDER BY "createdAt" LIMIT 1
)
WHERE "createdById" IN (SELECT "id" FROM "_demo_users")
  AND EXISTS (SELECT 1 FROM "users" WHERE "role" = 'ADMIN');

-- جای این حساب‌ها در بازی‌های بازِ فعالِ بازیکنان واقعی آزاد می‌شود و سهمشان از
-- صندوق بازی کم می‌شود؛ وگرنه بازی «پر» می‌ماند و میزبان سهم آن‌ها را هم می‌گرفت.
UPDATE "open_matches" m
SET "escrowBalance" = m."escrowBalance" - s."total", "status" = 'OPEN'::"OpenMatchStatus"
FROM (
  SELECT p."matchId", SUM(p."paidAmount") AS "total"
  FROM "open_match_players" p
  WHERE p."userId" IN (SELECT "id" FROM "_demo_users") AND p."isHost" = false
  GROUP BY p."matchId"
) s
WHERE m."id" = s."matchId"
  AND m."status" IN ('OPEN', 'FULL')
  AND m."hostId" NOT IN (SELECT "id" FROM "_demo_users");

-- رزروها (با سانس‌ها، سوابق لغو و بازی‌های بازِ رویشان) و بازی‌های میزبانی‌شده
DELETE FROM "bookings" WHERE "userId" IN (SELECT "id" FROM "_demo_users");
DELETE FROM "open_matches" WHERE "hostId" IN (SELECT "id" FROM "_demo_users");
DELETE FROM "notification_rule_deliveries" WHERE "userId" IN (SELECT "id" FROM "_demo_users");

-- خود حساب‌ها؛ پروفایل، کیف پول، تراکنش‌ها، اعلان‌ها و نشست‌ها همراهشان پاک می‌شود
DELETE FROM "users" WHERE "id" IN (SELECT "id" FROM "_demo_users");

DROP TABLE "_demo_users";

-- تورنومنت نمونه، اگر کسی در آن ثبت‌نام نکرده
DELETE FROM "tournaments" t
WHERE t."slug" = 'jam-tabestane-persian-padel'
  AND NOT EXISTS (SELECT 1 FROM "tournament_registrations" r WHERE r."tournamentId" = t."id");

-- خبرهای ساختگی (گزارش فینال با نام بازیکنان نمونه، افتتاح زمین ۳)
DELETE FROM "articles" WHERE "slug" IN ('گزارش-فینال-جام-تابستانه', 'افتتاح-زمین-شماره-سه');
