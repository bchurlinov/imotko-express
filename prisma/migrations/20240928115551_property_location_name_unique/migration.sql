/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `PropertyLocation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Agency_location_idx" ON "Agency"("location");

-- CreateIndex
CREATE INDEX "Agency_name_idx" ON "Agency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyLocation_name_key" ON "PropertyLocation"("name");
