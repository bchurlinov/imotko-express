/*
  Warnings:

  - You are about to drop the `NotificationSubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NotificationSubscription" DROP CONSTRAINT "NotificationSubscription_clientId_fkey";

-- DropTable
DROP TABLE "NotificationSubscription";

-- CreateTable
CREATE TABLE "ClientNotificationSubscription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "receiveCompanyEmail" BOOLEAN NOT NULL DEFAULT false,
    "receiveCompanySMS" BOOLEAN NOT NULL DEFAULT false,
    "receiveAgentEmail" BOOLEAN NOT NULL DEFAULT false,
    "receiveAgentSMS" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientNotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClientNotificationSubscription" ADD CONSTRAINT "ClientNotificationSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
