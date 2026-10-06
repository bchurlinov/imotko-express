-- CreateEnum
CREATE TYPE "PropertyPriceUnit" AS ENUM ('TOTAL', 'PER_SQUARE_METER', 'PER_NIGHT');

-- AlterEnum
ALTER TYPE "PropertyListingType" ADD VALUE 'short_term_rent';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "checkInFrom" TEXT,
ADD COLUMN     "checkOutUntil" TEXT,
ADD COLUMN     "maxGuests" INTEGER,
ADD COLUMN     "minNights" INTEGER,
ADD COLUMN     "priceUnit" "PropertyPriceUnit" NOT NULL DEFAULT 'TOTAL';

-- Keep today's "€/m²" label on cheap long-term rent rows (the old card heuristic treated price <= 50 as per m²).
UPDATE "Property"
SET "priceUnit" = 'PER_SQUARE_METER'
WHERE "listingType" = 'for_rent' AND "price" > 0 AND "price" <= 50;
