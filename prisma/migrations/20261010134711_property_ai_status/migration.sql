-- CreateEnum
CREATE TYPE "PropertyAiStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "aiStatus" "PropertyAiStatus";
