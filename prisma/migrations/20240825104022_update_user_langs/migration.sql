-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserLanguage" ADD VALUE 'EN';
ALTER TYPE "UserLanguage" ADD VALUE 'MK';
ALTER TYPE "UserLanguage" ADD VALUE 'AL';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "language" DROP NOT NULL;
