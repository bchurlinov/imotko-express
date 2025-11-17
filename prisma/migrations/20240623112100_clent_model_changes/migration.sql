-- DropForeignKey
ALTER TABLE "PropertyView" DROP CONSTRAINT "PropertyView_clientId_fkey";

-- AddForeignKey
ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
