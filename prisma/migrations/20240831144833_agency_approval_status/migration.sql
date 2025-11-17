-- CreateEnum
CREATE TYPE "AgencyApprovalStatus" AS ENUM ('DECLINED', 'PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "status" "AgencyApprovalStatus" NOT NULL DEFAULT 'PENDING';
