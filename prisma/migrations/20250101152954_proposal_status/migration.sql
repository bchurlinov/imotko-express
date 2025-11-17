-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('published', 'unpublished', 'deleted');

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "status" "ProposalStatus" NOT NULL DEFAULT 'published';
