-- CreateEnum
CREATE TYPE "AgencuSubscriptionPlan" AS ENUM ('BASIC', 'PREMIUM');

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "subscriptionPlan" "AgencuSubscriptionPlan" NOT NULL DEFAULT 'BASIC';
