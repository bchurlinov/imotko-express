/*
  Warnings:

  - You are about to drop the column `type` on the `PropertyCategory` table. All the data in the column will be lost.
  - Changed the type of `name` on the `PropertyCategory` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "PropertyType" ADD VALUE 'PropertyTyp';

-- AlterTable
ALTER TABLE "PropertyCategory" DROP COLUMN "type",
DROP COLUMN "name",
ADD COLUMN     "name" "PropertyType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyCategory_name_key" ON "PropertyCategory"("name");
