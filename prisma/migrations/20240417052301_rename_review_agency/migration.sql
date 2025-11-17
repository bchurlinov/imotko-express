/*
  Warnings:

  - You are about to drop the `Rating` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_clientId_fkey";

-- DropTable
DROP TABLE "Rating";

-- CreateTable
CREATE TABLE "AgencyReview" (
    "id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attributes" JSONB,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "AgencyReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgencyReview" ADD CONSTRAINT "AgencyReview_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyReview" ADD CONSTRAINT "AgencyReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
