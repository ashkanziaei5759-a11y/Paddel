-- رزرو برای مشتری متفرقه (بدون حساب) و پرداخت کارت به کارت در رزرو تلفنی

-- CreateEnum
CREATE TYPE "BookingPaymentMethod" AS ENUM ('WALLET', 'POINTS', 'CARD_TO_CARD', 'FREE');

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "bookings" ADD COLUMN "guestName" TEXT,
ADD COLUMN "guestPhone" TEXT,
ADD COLUMN "paymentMethod" "BookingPaymentMethod",
ADD COLUMN "cardAmount" BIGINT,
ADD COLUMN "cardReceipt" TEXT;

-- CreateIndex
CREATE INDEX "bookings_cardReceipt_idx" ON "bookings"("cardReceipt");

-- اعلان تسویه‌ی بازی باز برای میزبان
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_SETTLED';
