-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "bumpedAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Property_bumpedAt_idx" ON "public"."Property"("bumpedAt");
