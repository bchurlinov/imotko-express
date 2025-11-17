-- DropForeignKey
ALTER TABLE "PropertySale" DROP CONSTRAINT "PropertySale_propertyId_fkey";

-- AddForeignKey
ALTER TABLE "PropertySale" ADD CONSTRAINT "PropertySale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
