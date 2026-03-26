-- DropIndex
DROP INDEX "Property_propertyLocationId_idx";

-- CreateIndex
CREATE INDEX "Property_featured_idx" ON "Property"("featured");

-- CreateIndex
CREATE INDEX "Property_categoryId_idx" ON "Property"("categoryId");

-- CreateIndex
CREATE INDEX "Property_subcategoryId_idx" ON "Property"("subcategoryId");
