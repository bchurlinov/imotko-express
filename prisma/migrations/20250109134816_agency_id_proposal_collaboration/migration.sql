-- AlterTable
ALTER TABLE "ProposalCollaboration" ADD COLUMN     "agencyId" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;
