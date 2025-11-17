/*
  Warnings:

  - The values [ENGLISH,MACEDONIAN,ALBANIAN] on the enum `UserLanguage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserLanguage_new" AS ENUM ('EN', 'MK', 'AL');
ALTER TABLE "User" ALTER COLUMN "language" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "language" TYPE "UserLanguage_new" USING ("language"::text::"UserLanguage_new");
ALTER TYPE "UserLanguage" RENAME TO "UserLanguage_old";
ALTER TYPE "UserLanguage_new" RENAME TO "UserLanguage";
DROP TYPE "UserLanguage_old";
ALTER TABLE "User" ALTER COLUMN "language" SET DEFAULT 'MK';
COMMIT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "language" SET DEFAULT 'MK';
