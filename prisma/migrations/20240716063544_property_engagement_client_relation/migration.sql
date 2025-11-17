/*
  Warnings:

  - The `plan` column on the `Agency` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AgencyPlan" AS ENUM ('BASIC', 'PREMIUM');

-- AlterTable
ALTER TABLE "Agency" DROP COLUMN "plan",
ADD COLUMN     "plan" "AgencyPlan" NOT NULL DEFAULT 'BASIC';

-- DropEnum
DROP TYPE "AgencuSubscriptionPlan";

-- AddForeignKey
ALTER TABLE "PropertyEngagement" ADD CONSTRAINT "PropertyEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
