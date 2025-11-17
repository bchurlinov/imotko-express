/*
  Warnings:

  - You are about to drop the column `userId` on the `Agency` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Agency_userId_key";

-- AlterTable
ALTER TABLE "Agency" DROP COLUMN "userId";
