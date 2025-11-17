-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_agencyId_fkey";

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
