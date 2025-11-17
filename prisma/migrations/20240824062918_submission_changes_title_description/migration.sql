/*
  Warnings:

  - Added the required column `title` to the `PropertySubmissionReview` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `description` on the `PropertySubmissionReview` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "PropertySubmissionReview" ADD COLUMN     "title" JSONB NOT NULL,
DROP COLUMN "description",
ADD COLUMN     "description" JSONB NOT NULL;
