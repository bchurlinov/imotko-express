-- DropIndex
DROP INDEX "User_email_idx";

-- CreateIndex
CREATE INDEX "User_email_agencyId_clientId_idx" ON "User"("email", "agencyId", "clientId");
