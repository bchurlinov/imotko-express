/*
  Warnings:

  - You are about to drop the column `hasFurniture` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `needsRenovation` on the `Property` table. All the data in the column will be lost.
  - Made the column `propertyDeed` on table `Property` required. This step will fail if there are existing NULL values in that column.
  - Made the column `clientId` on table `PropertyView` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "taxNumber" TEXT;

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "hasFurniture",
DROP COLUMN "needsRenovation",
ADD COLUMN     "approximatePrice" INTEGER,
ALTER COLUMN "propertyDeed" SET NOT NULL,
ALTER COLUMN "propertyDeed" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "PropertyView" ALTER COLUMN "clientId" SET NOT NULL;

-- CreateTable
CREATE TABLE "PropertySale" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertySale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertySale_propertyId_key" ON "PropertySale"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySale_agencyId_key" ON "PropertySale"("agencyId");

-- AddForeignKey
ALTER TABLE "PropertySale" ADD CONSTRAINT "PropertySale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySale" ADD CONSTRAINT "PropertySale_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
