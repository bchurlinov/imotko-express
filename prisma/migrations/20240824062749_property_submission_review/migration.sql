-- CreateEnum
CREATE TYPE "PropertyReviewStatus" AS ENUM ('PENDING', 'DECLINED', 'APPROVED');

-- CreateTable
CREATE TABLE "PropertySubmissionReview" (
    "id" TEXT NOT NULL,
    "status" "PropertyReviewStatus" NOT NULL DEFAULT 'PENDING',
    "propertyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertySubmissionReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PropertySubmissionReview" ADD CONSTRAINT "PropertySubmissionReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
