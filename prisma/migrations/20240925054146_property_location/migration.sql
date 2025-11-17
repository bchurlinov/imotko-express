-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "propertyLocationId" TEXT;

-- CreateTable
CREATE TABLE "PropertyLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "PropertyLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_propertyLocationId_fkey" FOREIGN KEY ("propertyLocationId") REFERENCES "PropertyLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PropertyLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
