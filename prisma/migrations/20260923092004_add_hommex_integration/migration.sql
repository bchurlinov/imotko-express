-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "hommexPublishedAt" TIMESTAMPTZ(3),
ADD COLUMN     "hommexSync" JSONB,
ADD COLUMN     "publishToHommex" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AgencyHommexConnection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "encryptedApiKey" TEXT NOT NULL,
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyHommexConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyHommexConnection_agencyId_key" ON "AgencyHommexConnection"("agencyId");

-- AddForeignKey
ALTER TABLE "AgencyHommexConnection" ADD CONSTRAINT "AgencyHommexConnection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
