-- DropIndex
DROP INDEX "Property_name_location_promotionExpiresAt_idx";

-- CreateIndex
CREATE INDEX "Property_location_listingType_idx" ON "Property"("location", "listingType");

-- CreateIndex
CREATE INDEX "Property_location_idx" ON "Property"("location");

-- CreateIndex
CREATE INDEX "Property_agencyId_idx" ON "Property"("agencyId");
