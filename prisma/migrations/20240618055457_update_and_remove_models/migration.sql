/*
  Warnings:

  - You are about to drop the `AgencyFeature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Feature` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgencyFeature" DROP CONSTRAINT "AgencyFeature_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "AgencyFeature" DROP CONSTRAINT "AgencyFeature_featureId_fkey";

-- DropForeignKey
ALTER TABLE "AgencyReview" DROP CONSTRAINT "AgencyReview_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "PropertySale" DROP CONSTRAINT "PropertySale_agencyId_fkey";

-- DropTable
DROP TABLE "AgencyFeature";

-- DropTable
DROP TABLE "Feature";

-- AddForeignKey
ALTER TABLE "AgencyReview" ADD CONSTRAINT "AgencyReview_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySale" ADD CONSTRAINT "PropertySale_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
