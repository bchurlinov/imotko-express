-- CreateEnum
CREATE TYPE "public"."AgencyClientPreferenceStatus" AS ENUM ('active', 'sent', 'interested', 'not_interested', 'inactive', 'expired');

-- AlterTable
ALTER TABLE "public"."AgencyClientPreference" ADD COLUMN     "lastOfferSentAt" TIMESTAMP(3),
ADD COLUMN     "status" "public"."AgencyClientPreferenceStatus" NOT NULL DEFAULT 'active';
