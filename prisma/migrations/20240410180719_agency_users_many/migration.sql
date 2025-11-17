-- DropForeignKey
ALTER TABLE "Agency" DROP CONSTRAINT "Agency_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agencyId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
