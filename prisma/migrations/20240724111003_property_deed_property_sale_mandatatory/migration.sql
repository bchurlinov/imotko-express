/*
  Warnings:

  - Made the column `propertyDeed` on table `PropertySale` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PropertySale" ALTER COLUMN "propertyDeed" SET NOT NULL;
