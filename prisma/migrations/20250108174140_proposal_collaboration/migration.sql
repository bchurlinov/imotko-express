/*
  Warnings:

  - A unique constraint covering the columns `[collaborationId]` on the table `ProposalOffer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProposalOffer" ADD COLUMN     "collaborationId" TEXT;

-- CreateTable
CREATE TABLE "ProposalCollaboration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProposalCollaboration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalOffer_collaborationId_key" ON "ProposalOffer"("collaborationId");

-- AddForeignKey
ALTER TABLE "ProposalOffer" ADD CONSTRAINT "ProposalOffer_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "ProposalCollaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalCollaboration" ADD CONSTRAINT "ProposalCollaboration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
