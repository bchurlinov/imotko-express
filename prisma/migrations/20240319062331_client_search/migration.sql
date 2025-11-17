/*
  Warnings:

  - A unique constraint covering the columns `[clientSearchId]` on the table `ClientPropertySubscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientSearchId` to the `ClientPropertySubscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientPropertySubscription" ADD COLUMN     "clientSearchId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientPropertySubscription_clientSearchId_key" ON "ClientPropertySubscription"("clientSearchId");

-- AddForeignKey
ALTER TABLE "ClientPropertySubscription" ADD CONSTRAINT "ClientPropertySubscription_clientSearchId_fkey" FOREIGN KEY ("clientSearchId") REFERENCES "ClientSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
