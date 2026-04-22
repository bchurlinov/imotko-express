-- DropIndex
DROP INDEX "LeadReveal_leadId_idx";

-- CreateIndex
CREATE INDEX "Lead_isActive_createdAt_idx" ON "Lead"("isActive", "createdAt" DESC);
