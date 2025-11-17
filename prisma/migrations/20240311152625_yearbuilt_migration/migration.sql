/*
  Warnings:

  - The `yearBuilt` column on the `Property` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "yearBuilt",
ADD COLUMN     "yearBuilt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
