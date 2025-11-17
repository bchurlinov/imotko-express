/*
  Warnings:

  - You are about to drop the column `name` on the `PropertyCategory` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `PropertySubcategory` table. All the data in the column will be lost.
  - Made the column `value` on table `PropertyCategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `value` on table `PropertySubcategory` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "PropertyCategory_name_key";

-- AlterTable
ALTER TABLE "PropertyCategory" DROP COLUMN "name",
ALTER COLUMN "value" SET NOT NULL;

-- AlterTable
ALTER TABLE "PropertySubcategory" DROP COLUMN "name",
ALTER COLUMN "value" SET NOT NULL;
