-- CreateEnum
CREATE TYPE "PropertyCountry" AS ENUM ('macedonia', 'serbia', 'albania', 'greece');

-- AlterTable
ALTER TABLE "Property"
ADD COLUMN "country" "PropertyCountry" NOT NULL DEFAULT 'macedonia';

-- CreateIndex
CREATE INDEX "Property_country_propertyLocationId_listingType_idx"
ON "Property"("country", "propertyLocationId", "listingType");
