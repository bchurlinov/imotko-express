/*
  Warnings:

  - Added the required column `category` to the `Proposal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `listingType` to the `Proposal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "category" "PropertyType" NOT NULL,
ADD COLUMN     "listingType" "PropertyListingType" NOT NULL;
