-- CreateEnum
CREATE TYPE "AgencyMemberPosition" AS ENUM ('SALES', 'RENT', 'MARKETING', 'IT', 'LEGAL', 'HR', 'ACCOUNTING');

-- AlterTable
ALTER TABLE "AgencyMember" ADD COLUMN     "position" "AgencyMemberPosition";
