-- AlterTable
ALTER TABLE "AgencyClientPreference" ADD COLUMN     "offeredPropertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
