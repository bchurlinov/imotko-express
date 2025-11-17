-- DropIndex
DROP INDEX "User_email_agencyId_clientId_idx";

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");
