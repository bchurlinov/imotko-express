-- CreateEnum
CREATE TYPE "OutreachUnlockType" AS ENUM ('FREE_LAUNCH', 'PLAN_PREMIUM', 'FREE_MONTHLY', 'CREDITS');

-- AlterTable
ALTER TABLE "AgencyMember" ADD COLUMN     "privateListingsSeenAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "agencyContactAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "firstPublishedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "PropertyOutreach" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "memberId" TEXT,
    "clientId" TEXT,
    "conversationId" TEXT,
    "unlockType" "OutreachUnlockType" NOT NULL,
    "creditsSpent" INTEGER NOT NULL DEFAULT 0,
    "freePeriod" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyOutreach_conversationId_key" ON "PropertyOutreach"("conversationId");

-- CreateIndex
CREATE INDEX "PropertyOutreach_agencyId_createdAt_idx" ON "PropertyOutreach"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyOutreach_propertyId_idx" ON "PropertyOutreach"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyOutreach_agencyId_propertyId_key" ON "PropertyOutreach"("agencyId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyOutreach_agencyId_freePeriod_key" ON "PropertyOutreach"("agencyId", "freePeriod");

-- CreateIndex
CREATE INDEX "Property_clientId_status_firstPublishedAt_idx" ON "Property"("clientId", "status", "firstPublishedAt");

-- AddForeignKey
ALTER TABLE "PropertyOutreach" ADD CONSTRAINT "PropertyOutreach_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyOutreach" ADD CONSTRAINT "PropertyOutreach_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyOutreach" ADD CONSTRAINT "PropertyOutreach_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyOutreach" ADD CONSTRAINT "PropertyOutreach_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyOutreach" ADD CONSTRAINT "PropertyOutreach_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (design C §2, plan C deviation 11): every private listing that was approved at least once. The approve
-- route writes "modifications", so a non-null value means "approved before"; createdAt is the best known date.
UPDATE "Property"
SET "firstPublishedAt" = "createdAt"
WHERE "clientId" IS NOT NULL
  AND "modifications" IS NOT NULL
  AND "status" <> 'DELETED'
  AND "firstPublishedAt" IS NULL;
