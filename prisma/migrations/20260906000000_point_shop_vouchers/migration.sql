-- CreateEnum
CREATE TYPE "StoreSection" AS ENUM ('MARKET', 'POINT_SHOP');
CREATE TYPE "VoucherKind" AS ENUM ('FREE_SESSION', 'PERCENT_DISCOUNT');
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PointsTxType" ADD VALUE 'VOUCHER_PURCHASE';
ALTER TYPE "PointsTxType" ADD VALUE 'VOUCHER_REFUND';
ALTER TYPE "PointsTxType" ADD VALUE 'BOOKING_PAYMENT';
ALTER TYPE "PointsTxType" ADD VALUE 'BOOKING_REFUND';
ALTER TYPE "PointsTxType" ADD VALUE 'CONVERTED_TO_WALLET';

-- AlterTable
ALTER TABLE "store_products"
  ADD COLUMN "section" "StoreSection" NOT NULL DEFAULT 'MARKET',
  ADD COLUMN "voucherKind" "VoucherKind",
  ADD COLUMN "voucherPercent" INTEGER,
  ADD COLUMN "voucherMaxRial" BIGINT,
  ADD COLUMN "voucherDays" INTEGER;

CREATE INDEX "store_products_isActive_section_sortOrder_idx"
  ON "store_products"("isActive", "section", "sortOrder");

-- CreateTable
CREATE TABLE "booking_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "VoucherKind" NOT NULL,
    "percentOff" INTEGER NOT NULL DEFAULT 100,
    "maxDiscountRial" BIGINT,
    "pointsSpent" INTEGER NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_vouchers_code_key" ON "booking_vouchers"("code");
CREATE UNIQUE INDEX "booking_vouchers_bookingId_key" ON "booking_vouchers"("bookingId");
CREATE INDEX "booking_vouchers_userId_status_idx" ON "booking_vouchers"("userId", "status");
CREATE INDEX "booking_vouchers_status_expiresAt_idx" ON "booking_vouchers"("status", "expiresAt");

ALTER TABLE "booking_vouchers" ADD CONSTRAINT "booking_vouchers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_vouchers" ADD CONSTRAINT "booking_vouchers_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_vouchers" ADD CONSTRAINT "booking_vouchers_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "store_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
