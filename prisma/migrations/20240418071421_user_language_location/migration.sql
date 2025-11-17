/*
  Warnings:

  - The `language` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserLanguage" AS ENUM ('ENGLISH', 'MACEDONIAN', 'ALBANIAN');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "language",
ADD COLUMN     "language" "UserLanguage" NOT NULL DEFAULT 'MACEDONIAN';

-- DropEnum
DROP TYPE "UserLanugage";
