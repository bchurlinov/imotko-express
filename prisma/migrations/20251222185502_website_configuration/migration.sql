-- CreateTable
CREATE TABLE "AgencyWebsiteSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "enableRentals" BOOLEAN NOT NULL DEFAULT true,
    "serviceAreas" TEXT[],
    "analyticsCode" TEXT,
    "template" TEXT NOT NULL DEFAULT 'default',
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "secondaryColor" TEXT,
    "heroImage" JSONB,
    "siteTitle" TEXT,
    "tagline" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyWebsiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyTestimonial" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "location" TEXT,
    "content" TEXT NOT NULL,
    "dateCreated" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyWebsiteSettings_agencyId_key" ON "AgencyWebsiteSettings"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyTestimonial_agencyId_idx" ON "AgencyTestimonial"("agencyId");

-- AddForeignKey
ALTER TABLE "AgencyWebsiteSettings" ADD CONSTRAINT "AgencyWebsiteSettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyTestimonial" ADD CONSTRAINT "AgencyTestimonial_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
