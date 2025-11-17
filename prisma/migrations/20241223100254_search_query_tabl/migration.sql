-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "listingType" "PropertyListingType" NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "sizeFrom" INTEGER,
    "sizeTo" INTEGER,
    "clientId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchQuery_location_listingType_category_idx" ON "SearchQuery"("location", "listingType", "category");
