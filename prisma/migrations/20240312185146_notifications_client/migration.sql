-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "receiveCompanyEmail" BOOLEAN NOT NULL DEFAULT false,
    "receiveCompanySMS" BOOLEAN NOT NULL DEFAULT false,
    "receiveAgentEmail" BOOLEAN NOT NULL DEFAULT false,
    "receiveAgentSMS" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
