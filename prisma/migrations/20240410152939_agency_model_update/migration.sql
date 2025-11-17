/*
  Warnings:

  - You are about to drop the column `rating` on the `Agency` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agency" DROP COLUMN "rating";

-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attributes" JSONB;
