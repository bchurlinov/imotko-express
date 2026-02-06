-- CreateTable
CREATE TABLE "AgencyPartner" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" JSONB,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyPartner_agencyId_idx" ON "AgencyPartner"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyPartner_sortOrder_idx" ON "AgencyPartner"("sortOrder");

-- AddForeignKey
ALTER TABLE "AgencyPartner" ADD CONSTRAINT "AgencyPartner_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
