/*
  Warnings:

  - A unique constraint covering the columns `[value,categoryId]` on the table `PropertySubcategory` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PropertySubcategory_name_categoryId_key";

-- AlterTable
ALTER TABLE "PropertyCategory" ADD COLUMN     "value" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PropertySubcategory" ADD COLUMN     "value" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PropertySubcategory_value_categoryId_key" ON "PropertySubcategory"("value", "categoryId");
