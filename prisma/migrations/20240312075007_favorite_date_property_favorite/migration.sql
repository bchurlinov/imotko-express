/*
  Warnings:

  - You are about to drop the column `viewDate` on the `PropertyFavorite` table. All the data in the column will be lost.
  - Added the required column `favoriteDate` to the `PropertyFavorite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PropertyFavorite" DROP COLUMN "viewDate",
ADD COLUMN     "favoriteDate" TIMESTAMPTZ(3) NOT NULL;
