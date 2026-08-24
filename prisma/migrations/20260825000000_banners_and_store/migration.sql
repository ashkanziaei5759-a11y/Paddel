-- CreateEnum
CREATE TYPE "StorePaymentMethod" AS ENUM ('POINTS', 'WALLET');

-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StoreCategory" AS ENUM ('RACKET', 'BALL', 'APPAREL', 'ACCESSORY', 'SERVICE');

-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HOME_TOP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTxType" ADD VALUE 'STORE_PURCHASE';
ALTER TYPE "WalletTxType" ADD VALUE 'STORE_REFUND';

-- AlterTable
ALTER TABLE "store_order_items" ADD COLUMN     "nameSnapshot" TEXT NOT NULL,
ADD COLUMN     "rialEach" BIGINT NOT NULL DEFAULT 0,
ALTER COLUMN "pointsEach" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "store_orders" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "method" "StorePaymentMethod" NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "totalRial" BIGINT NOT NULL DEFAULT 0,
ALTER COLUMN "totalPoints" SET DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "store_products" ADD COLUMN     "category" "StoreCategory" NOT NULL DEFAULT 'ACCESSORY',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "pricePoints" DROP NOT NULL,
ALTER COLUMN "isActive" SET DEFAULT true;

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "storeOrderId" TEXT;

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "placement" "BannerPlacement" NOT NULL DEFAULT 'HOME_TOP',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_placement_isActive_sortOrder_idx" ON "banners"("placement", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "store_order_items_orderId_idx" ON "store_order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "store_orders_code_key" ON "store_orders"("code");

-- CreateIndex
CREATE INDEX "store_orders_status_idx" ON "store_orders"("status");

-- CreateIndex
CREATE INDEX "store_products_isActive_category_sortOrder_idx" ON "store_products"("isActive", "category", "sortOrder");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_storeOrderId_fkey" FOREIGN KEY ("storeOrderId") REFERENCES "store_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

