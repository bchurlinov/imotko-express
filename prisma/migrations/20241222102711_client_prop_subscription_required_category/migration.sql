/*
  Warnings:

  - Made the column `category` on table `ClientPropertySubscription` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ClientPropertySubscription" ALTER COLUMN "category" SET NOT NULL;
