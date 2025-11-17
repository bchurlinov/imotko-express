-- DropForeignKey
ALTER TABLE "AgencyClientNotes" DROP CONSTRAINT "AgencyClientNotes_agencyClientId_fkey";

-- AddForeignKey
ALTER TABLE "AgencyClientNotes" ADD CONSTRAINT "AgencyClientNotes_agencyClientId_fkey" FOREIGN KEY ("agencyClientId") REFERENCES "AgencyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
