-- CreateTable
CREATE TABLE "AgencySubmissionReview" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencySubmissionReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgencySubmissionReview" ADD CONSTRAINT "AgencySubmissionReview_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
