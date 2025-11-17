/*
  Warnings:

  - Made the column `agencyId` on table `ProposalCollaboration` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `title` to the `ProposalOffer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProposalCollaboration" ALTER COLUMN "agencyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProposalOffer" ADD COLUMN     "title" TEXT NOT NULL;
