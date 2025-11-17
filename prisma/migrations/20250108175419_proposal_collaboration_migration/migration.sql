/*
  Warnings:

  - You are about to drop the column `collaborationId` on the `ProposalOffer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[proposalOfferId]` on the table `ProposalCollaboration` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "ProposalOffer" DROP CONSTRAINT "ProposalOffer_collaborationId_fkey";

-- DropIndex
DROP INDEX "ProposalOffer_collaborationId_key";

-- AlterTable
ALTER TABLE "ProposalCollaboration" ADD COLUMN     "proposalOfferId" TEXT;

-- AlterTable
ALTER TABLE "ProposalOffer" DROP COLUMN "collaborationId";

-- CreateIndex
CREATE UNIQUE INDEX "ProposalCollaboration_proposalOfferId_key" ON "ProposalCollaboration"("proposalOfferId");

-- AddForeignKey
ALTER TABLE "ProposalCollaboration" ADD CONSTRAINT "ProposalCollaboration_proposalOfferId_fkey" FOREIGN KEY ("proposalOfferId") REFERENCES "ProposalOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
