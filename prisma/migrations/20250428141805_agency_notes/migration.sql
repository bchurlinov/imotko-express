/*
  Warnings:

  - You are about to drop the column `notes` on the `AgencyClient` table. All the data in the column will be lost.
  - Added the required column `agencyClientId` to the `AgencyClientNotes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AgencyClient" DROP COLUMN "notes";

-- AlterTable
ALTER TABLE "AgencyClientNotes" ADD COLUMN     "agencyClientId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "AgencyClientNotes" ADD CONSTRAINT "AgencyClientNotes_agencyClientId_fkey" FOREIGN KEY ("agencyClientId") REFERENCES "AgencyClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
