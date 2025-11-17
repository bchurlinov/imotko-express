-- CreateTable
CREATE TABLE "AgencyClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyClientPreference" (
    "id" TEXT NOT NULL,
    "propertyType" "PropertyType",
    "listingType" "PropertyListingType",
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "minSize" INTEGER,
    "maxSize" INTEGER,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "locationId" TEXT,
    "agencyClientId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyClientPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyClientPreference_agencyClientId_idx" ON "AgencyClientPreference"("agencyClientId");

-- CreateIndex
CREATE INDEX "AgencyClientPreference_minPrice_maxPrice_propertyType_idx" ON "AgencyClientPreference"("minPrice", "maxPrice", "propertyType");

-- AddForeignKey
ALTER TABLE "AgencyClient" ADD CONSTRAINT "AgencyClient_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyClientPreference" ADD CONSTRAINT "AgencyClientPreference_agencyClientId_fkey" FOREIGN KEY ("agencyClientId") REFERENCES "AgencyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
