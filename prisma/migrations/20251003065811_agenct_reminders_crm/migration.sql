-- CreateEnum
CREATE TYPE "public"."ReminderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."AgentReminder" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."ReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "agencyMemberId" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "endDate" TIMESTAMPTZ(3),
    "lastSentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AgentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentReminder_agencyMemberId_idx" ON "public"."AgentReminder"("agencyMemberId");

-- CreateIndex
CREATE INDEX "AgentReminder_status_idx" ON "public"."AgentReminder"("status");

-- AddForeignKey
ALTER TABLE "public"."AgentReminder" ADD CONSTRAINT "AgentReminder_agencyMemberId_fkey" FOREIGN KEY ("agencyMemberId") REFERENCES "public"."AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
