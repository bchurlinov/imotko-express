-- CreateEnum
CREATE TYPE "PropertyReportReason" AS ENUM ('SCAM', 'MISLEADING', 'UNAVAILABLE', 'DUPLICATE', 'INAPPROPRIATE', 'OTHER');

-- CreateTable
CREATE TABLE "PropertyReport" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "reason" "PropertyReportReason" NOT NULL,
    "message" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyReport_resolvedAt_createdAt_idx" ON "PropertyReport"("resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyReport_propertyId_idx" ON "PropertyReport"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyReport_reporterUserId_propertyId_idx" ON "PropertyReport"("reporterUserId", "propertyId");

-- AddForeignKey
ALTER TABLE "PropertyReport" ADD CONSTRAINT "PropertyReport_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyReport" ADD CONSTRAINT "PropertyReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

