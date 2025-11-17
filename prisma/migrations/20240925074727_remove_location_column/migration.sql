/*
  Warnings:

  - You are about to drop the column `location` on the `Property` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Property_location_idx";

-- DropIndex
DROP INDEX "Property_location_listingType_idx";

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "location";

-- CreateIndex
CREATE INDEX "Property_propertyLocationId_listingType_idx" ON "Property"("propertyLocationId", "listingType");

-- CreateIndex
CREATE INDEX "Property_propertyLocationId_idx" ON "Property"("propertyLocationId");
