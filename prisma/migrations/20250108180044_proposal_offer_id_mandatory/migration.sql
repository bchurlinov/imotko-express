/*
  Warnings:

  - Made the column `proposalOfferId` on table `ProposalCollaboration` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ProposalCollaboration" ALTER COLUMN "proposalOfferId" SET NOT NULL;
