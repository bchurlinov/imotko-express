-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "createdByMemberId" TEXT;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
