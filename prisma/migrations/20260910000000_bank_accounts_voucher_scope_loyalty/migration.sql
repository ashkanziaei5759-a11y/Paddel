-- CreateEnum
CREATE TYPE "VoucherScope" AS ENUM ('BOOKING', 'TOURNAMENT', 'ANY');

-- AlterEnum: پاداش وفاداری و ردگیری هدیه
ALTER TYPE "PointsTxType" ADD VALUE 'BOOKING_REWARD';
ALTER TYPE "PointsTxType" ADD VALUE 'BOOKING_REWARD_REVERSAL';
ALTER TYPE "PointsTxType" ADD VALUE 'VOUCHER_GIFT';

-- AlterEnum: اعلان‌های تازه
ALTER TYPE "NotificationType" ADD VALUE 'VOUCHER_GIFT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'VOUCHER_EXPIRING';

-- AlterTable: دامنه‌ی بن روی کالای فروشگاه
ALTER TABLE "store_products"
  ADD COLUMN "voucherScope" "VoucherScope" NOT NULL DEFAULT 'BOOKING';

-- AlterTable: دامنه، مصرف روی تورنومنت، رد هدیه، و یادآوری انقضا
ALTER TABLE "booking_vouchers"
  ADD COLUMN "scope" "VoucherScope" NOT NULL DEFAULT 'BOOKING',
  ADD COLUMN "registrationId" TEXT,
  ADD COLUMN "giftedFromId" TEXT,
  ADD COLUMN "giftedAt" TIMESTAMP(3),
  ADD COLUMN "expiryNotifiedAt" TIMESTAMP(3);

-- یک ثبت‌نام تورنومنت، حداکثر یک بن. تضمین در سطح دیتابیس.
CREATE UNIQUE INDEX "booking_vouchers_registrationId_key"
  ON "booking_vouchers"("registrationId");

ALTER TABLE "booking_vouchers"
  ADD CONSTRAINT "booking_vouchers_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "tournament_registrations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_vouchers"
  ADD CONSTRAINT "booking_vouchers_giftedFromId_fkey"
  FOREIGN KEY ("giftedFromId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: اطلاعات بانکی بازیکن
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "cardNumber" TEXT,
    "iban" TEXT,
    "bankName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_accounts_userId_key" ON "bank_accounts"("userId");

ALTER TABLE "bank_accounts"
  ADD CONSTRAINT "bank_accounts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
