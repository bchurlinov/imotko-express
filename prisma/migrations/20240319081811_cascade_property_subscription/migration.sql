-- DropForeignKey
ALTER TABLE "ClientPropertySubscription" DROP CONSTRAINT "ClientPropertySubscription_clientSearchId_fkey";

-- AddForeignKey
ALTER TABLE "ClientPropertySubscription" ADD CONSTRAINT "ClientPropertySubscription_clientSearchId_fkey" FOREIGN KEY ("clientSearchId") REFERENCES "ClientSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
