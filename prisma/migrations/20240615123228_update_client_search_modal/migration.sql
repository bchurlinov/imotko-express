/*
  Warnings:

  - You are about to drop the column `agencyOffers` on the `ClientSearch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClientSearch" DROP COLUMN "agencyOffers",
ADD COLUMN     "agencyIds" TEXT[],
ADD COLUMN     "receiveOffers" BOOLEAN NOT NULL DEFAULT false;
