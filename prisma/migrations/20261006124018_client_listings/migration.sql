-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 150;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "isSeller" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "Property_clientId_listingType_status_idx" ON "Property"("clientId", "listingType", "status");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
