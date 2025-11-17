/*
  Warnings:

  - You are about to drop the column `createdBy` on the `AgencyView` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `PropertyView` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AgencyView" DROP COLUMN "createdBy";

-- AlterTable
ALTER TABLE "PropertyView" DROP COLUMN "createdBy";
