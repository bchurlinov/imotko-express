-- CreateEnum
CREATE TYPE "public"."ExternalListingCategory" AS ENUM ('FOR_SALE', 'FOR_RENT', 'TO_BUY', 'TO_RENT');

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "preferences" JSONB;

-- CreateTable
CREATE TABLE "public"."listings" (
    "id" TEXT NOT NULL,
    "category" "public"."ExternalListingCategory" NOT NULL,
    "fullName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "attributes" TEXT,
    "location" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_category_idx" ON "public"."listings"("category");

-- CreateIndex
CREATE INDEX "listings_location_idx" ON "public"."listings"("location");

-- CreateIndex
CREATE INDEX "listings_sourceName_idx" ON "public"."listings"("sourceName");

-- CreateIndex
CREATE INDEX "listings_createdAt_idx" ON "public"."listings"("createdAt");
