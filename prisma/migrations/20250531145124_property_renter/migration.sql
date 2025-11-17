-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "renterId" TEXT;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "AgencyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
