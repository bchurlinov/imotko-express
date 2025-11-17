/*
  Warnings:

  - You are about to drop the column `subscribedUntil` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionPlan` on the `Agency` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agency" DROP COLUMN "subscribedUntil",
DROP COLUMN "subscriptionPlan",
ADD COLUMN     "plan" "AgencuSubscriptionPlan" NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "planUntil" TIMESTAMP(3);
