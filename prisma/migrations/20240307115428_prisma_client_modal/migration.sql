/*
  Warnings:

  - You are about to drop the column `userId` on the `ClientSearch` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientId]` on the table `ClientSearch` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientId` to the `ClientSearch` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ClientSearch" DROP CONSTRAINT "ClientSearch_userId_fkey";

-- DropIndex
DROP INDEX "ClientSearch_userId_key";

-- AlterTable
ALTER TABLE "ClientSearch" DROP COLUMN "userId",
ADD COLUMN     "clientId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientSearch_clientId_key" ON "ClientSearch"("clientId");

-- AddForeignKey
ALTER TABLE "ClientSearch" ADD CONSTRAINT "ClientSearch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
