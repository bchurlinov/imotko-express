-- AlterTable
ALTER TABLE "AgencyClientPreference" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "AgencyClientPreference" ADD CONSTRAINT "AgencyClientPreference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
