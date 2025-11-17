-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featuredUntil" TIMESTAMP(3);
