-- CreateEnum
CREATE TYPE "LeadUnlockType" AS ENUM ('PLAN_PREMIUM', 'FREE_MONTHLY', 'CREDITS');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "paidUnlockCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LeadReveal" ADD COLUMN "creditsSpent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadReveal" ADD COLUMN "freePeriod" TEXT;
ALTER TABLE "LeadReveal" ADD COLUMN "unlockType" "LeadUnlockType" NOT NULL DEFAULT 'PLAN_PREMIUM';
ALTER TABLE "LeadReveal" ALTER COLUMN "unlockType" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Lead_isActive_paidUnlockCount_idx" ON "Lead"("isActive", "paidUnlockCount");

-- CreateIndex
CREATE UNIQUE INDEX "LeadReveal_agencyId_freePeriod_key" ON "LeadReveal"("agencyId", "freePeriod");
