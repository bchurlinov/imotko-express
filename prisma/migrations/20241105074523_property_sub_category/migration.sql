-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "propertySubTypeId" TEXT;

-- CreateTable
CREATE TABLE "PropertySubType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "PropertySubType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertySubType_name_key" ON "PropertySubType"("name");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_propertySubTypeId_fkey" FOREIGN KEY ("propertySubTypeId") REFERENCES "PropertySubType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySubType" ADD CONSTRAINT "PropertySubType_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PropertySubType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
