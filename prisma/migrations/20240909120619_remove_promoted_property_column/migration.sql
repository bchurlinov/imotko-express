/*
  Warnings:

  - You are about to drop the column `promoted` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `promotionExpiresAt` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "promoted",
DROP COLUMN "promotionExpiresAt";
