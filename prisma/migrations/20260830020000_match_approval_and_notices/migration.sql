-- CreateEnum
CREATE TYPE "MatchPlayerStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "open_match_players" ADD COLUMN "status" "MatchPlayerStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "open_matches" ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_JOIN_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_JOIN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_JOIN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'TOURNAMENT_ANNOUNCED';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_MESSAGE';
