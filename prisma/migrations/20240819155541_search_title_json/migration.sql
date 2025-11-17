/*
  Warnings:

  - Changed the type of `title` on the `ClientSearch` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ClientSearch" DROP COLUMN "title",
ADD COLUMN     "title" JSONB NOT NULL;
