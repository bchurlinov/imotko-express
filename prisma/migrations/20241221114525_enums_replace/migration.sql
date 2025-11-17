/*
  Warnings:

  - The values [FOR_RENT,FOR_SALE] on the enum `PropertyListingType` will be removed. If these variants are still used in the database, this will fail.
  - The values [NORTH,SOUTH,EAST,WEST,NORTHEAST,SOUTHEAST,NORTHWEST,SOUTHWEST] on the enum `PropertyOrientation` will be removed. If these variants are still used in the database, this will fail.
  - The values [FLAT,HOUSE,LAND,HOLIDAY_HOME,GARAGE,COMMERCIAL] on the enum `PropertyType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PropertyListingType_new" AS ENUM ('for_rent', 'for_sale');
ALTER TABLE "ClientPropertySubscription" ALTER COLUMN "listingType" TYPE "PropertyListingType_new" USING ("listingType"::text::"PropertyListingType_new");
ALTER TABLE "Property" ALTER COLUMN "listingType" TYPE "PropertyListingType_new" USING ("listingType"::text::"PropertyListingType_new");
ALTER TYPE "PropertyListingType" RENAME TO "PropertyListingType_old";
ALTER TYPE "PropertyListingType_new" RENAME TO "PropertyListingType";
DROP TYPE "PropertyListingType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PropertyOrientation_new" AS ENUM ('north', 'south', 'east', 'west', 'northeast', 'southeast', 'northwest', 'southwest');
ALTER TABLE "Property" ALTER COLUMN "orientation" TYPE "PropertyOrientation_new" USING ("orientation"::text::"PropertyOrientation_new");
ALTER TYPE "PropertyOrientation" RENAME TO "PropertyOrientation_old";
ALTER TYPE "PropertyOrientation_new" RENAME TO "PropertyOrientation";
DROP TYPE "PropertyOrientation_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PropertyType_new" AS ENUM ('flat', 'house', 'land', 'holiday_home', 'garage', 'commercial');
ALTER TABLE "ClientPropertySubscription" ALTER COLUMN "propertyType" TYPE "PropertyType_new" USING ("propertyType"::text::"PropertyType_new");
ALTER TABLE "Property" ALTER COLUMN "type" TYPE "PropertyType_new" USING ("type"::text::"PropertyType_new");
ALTER TYPE "PropertyType" RENAME TO "PropertyType_old";
ALTER TYPE "PropertyType_new" RENAME TO "PropertyType";
DROP TYPE "PropertyType_old";
COMMIT;
