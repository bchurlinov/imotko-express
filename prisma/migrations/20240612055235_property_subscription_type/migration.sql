/*
  Warnings:

  - You are about to drop the `ClientAgentPropertySubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PropertySubscriptionType" AS ENUM ('NORMAL', 'AGENCY');

-- DropForeignKey
ALTER TABLE "ClientAgentPropertySubscription" DROP CONSTRAINT "ClientAgentPropertySubscription_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ClientAgentPropertySubscription" DROP CONSTRAINT "ClientAgentPropertySubscription_clientSearchId_fkey";

-- AlterTable
ALTER TABLE "ClientPropertySubscription" ADD COLUMN     "subscriptionType" "PropertySubscriptionType" NOT NULL DEFAULT 'NORMAL';

-- DropTable
DROP TABLE "ClientAgentPropertySubscription";
