/*
  Warnings:

  - You are about to drop the column `propertySubTypeId` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the `PropertySubType` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_propertySubTypeId_fkey";

-- DropForeignKey
ALTER TABLE "PropertySubType" DROP CONSTRAINT "PropertySubType_parentId_fkey";

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "propertySubTypeId";

-- DropTable
DROP TABLE "PropertySubType";
