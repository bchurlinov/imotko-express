-- DropForeignKey
ALTER TABLE "public"."Property" DROP CONSTRAINT "Property_agencyId_fkey";

-- AlterTable
ALTER TABLE "public"."Property" ALTER COLUMN "agencyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
