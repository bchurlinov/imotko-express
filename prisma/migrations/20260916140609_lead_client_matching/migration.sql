-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "sharedWithAgencies" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "LeadClientMatchSend" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSearchId" TEXT,
    "subscriptionId" TEXT,
    "matchScore" INTEGER NOT NULL,
    "note" TEXT,
    "sentByUserId" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadClientMatchSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadClientMatchSend_leadId_idx" ON "LeadClientMatchSend"("leadId");

-- CreateIndex
CREATE INDEX "LeadClientMatchSend_clientId_idx" ON "LeadClientMatchSend"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadClientMatchSend_leadId_clientId_key" ON "LeadClientMatchSend"("leadId", "clientId");

-- CreateIndex
CREATE INDEX "ClientPropertySubscription_listingType_category_location_idx" ON "ClientPropertySubscription"("listingType", "category", "location");

-- CreateIndex
CREATE INDEX "Lead_isActive_sharedWithAgencies_createdAt_idx" ON "Lead"("isActive", "sharedWithAgencies", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "LeadClientMatchSend" ADD CONSTRAINT "LeadClientMatchSend_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadClientMatchSend" ADD CONSTRAINT "LeadClientMatchSend_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadClientMatchSend" ADD CONSTRAINT "LeadClientMatchSend_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
