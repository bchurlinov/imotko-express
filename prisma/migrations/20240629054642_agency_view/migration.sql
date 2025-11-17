/*
  Warnings:

  - Added the required column `createdBy` to the `PropertyView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PropertyView` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PropertyView" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- CreateTable
CREATE TABLE "AgencyView" (
    "id" TEXT NOT NULL,
    "viewDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyView_agencyId_idx" ON "AgencyView"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyView_clientId_idx" ON "AgencyView"("clientId");

-- AddForeignKey
ALTER TABLE "AgencyView" ADD CONSTRAINT "AgencyView_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyView" ADD CONSTRAINT "AgencyView_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
