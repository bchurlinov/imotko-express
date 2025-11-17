-- CreateEnum
CREATE TYPE "UserLanugage" AS ENUM ('ENGLISH', 'MACEDONIAN', 'ALBANIAN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" "UserLanugage" NOT NULL DEFAULT 'MACEDONIAN';
