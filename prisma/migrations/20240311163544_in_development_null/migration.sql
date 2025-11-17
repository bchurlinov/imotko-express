-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "promotionExpiresAt" DROP DEFAULT,
ALTER COLUMN "promotionExpiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "inDevelopment" SET DEFAULT false,
ALTER COLUMN "inDevelopmentUntil" DROP DEFAULT,
ALTER COLUMN "yearBuilt" DROP DEFAULT;
