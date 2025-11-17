/*
  Warnings:

  - A unique constraint covering the columns `[agencyId]` on the table `AgencySubmissionReview` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AgencySubmissionReview_agencyId_key" ON "AgencySubmissionReview"("agencyId");
