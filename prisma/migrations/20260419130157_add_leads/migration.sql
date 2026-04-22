-- CreateEnum
CREATE TYPE "LeadIntent" AS ENUM ('SELLING', 'BUYING', 'LAND_INVESTMENT');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "intent" "LeadIntent" NOT NULL,
    "teaserDesc" TEXT NOT NULL,
    "fullDesc" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "sizeFrom" INTEGER,
    "sizeTo" INTEGER,
    "size" INTEGER,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadReveal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadReveal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_intent_idx" ON "Lead"("intent");

-- CreateIndex
CREATE INDEX "Lead_location_idx" ON "Lead"("location");

-- CreateIndex
CREATE INDEX "Lead_isActive_idx" ON "Lead"("isActive");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "LeadReveal_leadId_idx" ON "LeadReveal"("leadId");

-- CreateIndex
CREATE INDEX "LeadReveal_agencyId_idx" ON "LeadReveal"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadReveal_leadId_agencyId_key" ON "LeadReveal"("leadId", "agencyId");

-- AddForeignKey
ALTER TABLE "LeadReveal" ADD CONSTRAINT "LeadReveal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadReveal" ADD CONSTRAINT "LeadReveal_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
