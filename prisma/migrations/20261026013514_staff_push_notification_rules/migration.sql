-- CreateEnum
CREATE TYPE "NotificationRuleTrigger" AS ENUM ('BEFORE_BOOKING', 'AFTER_BOOKING', 'INACTIVE_PLAYER', 'LOW_WALLET', 'SCHEDULED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CLUB_NEWS';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "NotificationRuleTrigger" NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 60,
    "thresholdAmount" BIGINT,
    "runAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rule_deliveries" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_rule_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "notification_rules_isActive_trigger_idx" ON "notification_rules"("isActive", "trigger");

-- CreateIndex
CREATE INDEX "notification_rule_deliveries_createdAt_idx" ON "notification_rule_deliveries"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rule_deliveries_ruleId_userId_refKey_key" ON "notification_rule_deliveries"("ruleId", "userId", "refKey");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rule_deliveries" ADD CONSTRAINT "notification_rule_deliveries_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- قانون پیش‌فرض: یادآوری یک ساعت پیش از بازی (جایگزین یادآوریِ ثابتِ قبلی)
INSERT INTO "notification_rules" ("id", "name", "trigger", "offset", "title", "body", "actionUrl", "isActive", "updatedAt")
VALUES ('rule_default_booking_reminder', 'یادآوری یک ساعت پیش از بازی', 'BEFORE_BOOKING', 60,
        'یادآوری بازی ⏰', '{name} عزیز، ساعت {time} زمین پدل ({court}) به نام شماست. منتظرتان هستیم!',
        NULL, true, CURRENT_TIMESTAMP);
