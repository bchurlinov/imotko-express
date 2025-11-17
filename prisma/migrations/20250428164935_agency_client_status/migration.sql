-- CreateEnum
CREATE TYPE "AgencyClientStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "AgencyClient" ADD COLUMN     "status" "AgencyClientStatus" DEFAULT 'active';
