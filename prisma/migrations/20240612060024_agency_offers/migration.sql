/*
  Warnings:

  - You are about to drop the column `subscriptionType` on the `ClientPropertySubscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClientPropertySubscription" DROP COLUMN "subscriptionType";

-- AlterTable
ALTER TABLE "ClientSearch" ADD COLUMN     "agencyOffers" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "PropertySubscriptionType";
