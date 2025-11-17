/*
  Warnings:

  - You are about to drop the `ClientNotificationSubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClientNotificationSubscription" DROP CONSTRAINT "ClientNotificationSubscription_clientId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "receiveAgentEmail" BOOLEAN DEFAULT false,
ADD COLUMN     "receiveAgentSMS" BOOLEAN DEFAULT false,
ADD COLUMN     "receiveCompanyEmail" BOOLEAN DEFAULT false,
ADD COLUMN     "receiveCompanySMS" BOOLEAN DEFAULT false;

-- DropTable
DROP TABLE "ClientNotificationSubscription";
