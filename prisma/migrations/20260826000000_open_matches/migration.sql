-- CreateEnum
CREATE TYPE "OpenMatchStatus" AS ENUM ('OPEN', 'FULL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchLevelPolicy" AS ENUM ('ANY', 'RANGE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MATCH_PLAYER_JOINED';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_PLAYER_LEFT';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTxType" ADD VALUE 'MATCH_JOIN';
ALTER TYPE "WalletTxType" ADD VALUE 'MATCH_LEAVE_REFUND';
ALTER TYPE "WalletTxType" ADD VALUE 'MATCH_PAYOUT';

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "openMatchId" TEXT;

-- CreateTable
CREATE TABLE "open_matches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "sharePerPlayer" BIGINT NOT NULL,
    "escrowBalance" BIGINT NOT NULL DEFAULT 0,
    "levelPolicy" "MatchLevelPolicy" NOT NULL DEFAULT 'ANY',
    "allowedLevels" "PlayerLevel"[],
    "status" "OpenMatchStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "open_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_match_players" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_match_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "open_matches_code_key" ON "open_matches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "open_matches_bookingId_key" ON "open_matches"("bookingId");

-- CreateIndex
CREATE INDEX "open_matches_status_idx" ON "open_matches"("status");

-- CreateIndex
CREATE INDEX "open_match_players_userId_idx" ON "open_match_players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "open_match_players_matchId_userId_key" ON "open_match_players"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_openMatchId_fkey" FOREIGN KEY ("openMatchId") REFERENCES "open_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_matches" ADD CONSTRAINT "open_matches_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_matches" ADD CONSTRAINT "open_matches_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_match_players" ADD CONSTRAINT "open_match_players_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "open_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_match_players" ADD CONSTRAINT "open_match_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

