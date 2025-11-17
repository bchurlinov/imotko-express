/*
  Warnings:

  - You are about to drop the column `approved` on the `Property` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PENDING', 'DECLINED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "approved",
ADD COLUMN     "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT';
