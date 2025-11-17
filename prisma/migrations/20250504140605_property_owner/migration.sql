-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AgencyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
