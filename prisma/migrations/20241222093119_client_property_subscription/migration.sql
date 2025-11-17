/*
  Warnings:

  - You are about to drop the column `propertyType` on the `ClientPropertySubscription` table. All the data in the column will be lost.
  - Added the required column `category` to the `ClientPropertySubscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientPropertySubscription" DROP COLUMN "propertyType",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "subCategory" TEXT;
