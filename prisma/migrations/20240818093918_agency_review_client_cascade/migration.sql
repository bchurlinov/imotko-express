-- DropForeignKey
ALTER TABLE "AgencyReview" DROP CONSTRAINT "AgencyReview_clientId_fkey";

-- AddForeignKey
ALTER TABLE "AgencyReview" ADD CONSTRAINT "AgencyReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
