-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "autoRenewEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRenewEndDate" TIMESTAMP(3),
ADD COLUMN     "autoRenewStartDate" TIMESTAMP(3),
ADD COLUMN     "lastAutoRenewedAt" TIMESTAMP(3);
