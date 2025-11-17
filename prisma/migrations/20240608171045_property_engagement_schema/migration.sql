-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('SHARE', 'SUBSCRIBE', 'FAVORITE');

-- CreateTable
CREATE TABLE "PropertyEngagement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertyEngagement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PropertyEngagement" ADD CONSTRAINT "PropertyEngagement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
