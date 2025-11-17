-- AlterTable
ALTER TABLE "AgencyClient" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "AgencyClient" ADD CONSTRAINT "AgencyClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
