-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'INTERESTED', 'CONVERTED', 'NOT_INTERESTED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('EMAIL', 'PHONE', 'VIBER', 'WHATSAPP', 'SMS', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "OutreachDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "OutreachOutcome" AS ENUM ('NO_ANSWER', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'CALL_BACK_LATER', 'WRONG_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "OutreachSource" AS ENUM ('PAZAR3', 'REKLAMA5', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'BOOKING', 'AIRBNB', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "OutreachOwnerIntent" AS ENUM ('SHORT_TERM', 'LONG_TERM', 'SALE');

-- CreateTable
CREATE TABLE "OutreachAgency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "website" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "estimatedListings" INTEGER,
    "source" "OutreachSource",
    "sourceDetail" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "status" "OutreachStatus" NOT NULL DEFAULT 'NEW',
    "nextFollowUpAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "convertedAgencyId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutreachAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAgencyContact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "viber" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutreachAgencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAgencyActivity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "contactId" TEXT,
    "campaignId" TEXT,
    "channel" "OutreachChannel" NOT NULL,
    "direction" "OutreachDirection" NOT NULL,
    "outcome" "OutreachOutcome",
    "note" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutreachAgencyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutreachEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmailCampaign" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "templateId" TEXT,
    "agencyCount" INTEGER NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "sentById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachEmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachOwner" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "propertyName" TEXT,
    "email" TEXT,
    "city" TEXT,
    "intents" "OutreachOwnerIntent"[] DEFAULT ARRAY[]::"OutreachOwnerIntent"[],
    "source" "OutreachSource",
    "sourceDetail" TEXT,
    "listingUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "status" "OutreachStatus" NOT NULL DEFAULT 'NEW',
    "nextFollowUpAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "convertedUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutreachOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachOwnerActivity" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "direction" "OutreachDirection" NOT NULL,
    "outcome" "OutreachOutcome",
    "note" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutreachOwnerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachAgency_archivedAt_status_idx" ON "OutreachAgency"("archivedAt", "status");

-- CreateIndex
CREATE INDEX "OutreachAgency_archivedAt_nextFollowUpAt_idx" ON "OutreachAgency"("archivedAt", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "OutreachAgency_convertedAgencyId_idx" ON "OutreachAgency"("convertedAgencyId");

-- CreateIndex
CREATE INDEX "OutreachAgencyContact_agencyId_idx" ON "OutreachAgencyContact"("agencyId");

-- CreateIndex
CREATE INDEX "OutreachAgencyContact_email_idx" ON "OutreachAgencyContact"("email");

-- CreateIndex
CREATE INDEX "OutreachAgencyActivity_agencyId_occurredAt_idx" ON "OutreachAgencyActivity"("agencyId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "OutreachAgencyActivity_channel_direction_occurredAt_idx" ON "OutreachAgencyActivity"("channel", "direction", "occurredAt");

-- CreateIndex
CREATE INDEX "OutreachAgencyActivity_campaignId_idx" ON "OutreachAgencyActivity"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEmailCampaign_campaignId_key" ON "OutreachEmailCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "OutreachEmailCampaign_createdAt_idx" ON "OutreachEmailCampaign"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachOwner_phone_key" ON "OutreachOwner"("phone");

-- CreateIndex
CREATE INDEX "OutreachOwner_archivedAt_status_idx" ON "OutreachOwner"("archivedAt", "status");

-- CreateIndex
CREATE INDEX "OutreachOwner_archivedAt_nextFollowUpAt_idx" ON "OutreachOwner"("archivedAt", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "OutreachOwner_convertedUserId_idx" ON "OutreachOwner"("convertedUserId");

-- CreateIndex
CREATE INDEX "OutreachOwnerActivity_ownerId_occurredAt_idx" ON "OutreachOwnerActivity"("ownerId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "OutreachOwnerActivity_channel_direction_occurredAt_idx" ON "OutreachOwnerActivity"("channel", "direction", "occurredAt");

-- AddForeignKey
ALTER TABLE "OutreachAgency" ADD CONSTRAINT "OutreachAgency_convertedAgencyId_fkey" FOREIGN KEY ("convertedAgencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAgency" ADD CONSTRAINT "OutreachAgency_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAgencyContact" ADD CONSTRAINT "OutreachAgencyContact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "OutreachAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAgencyActivity" ADD CONSTRAINT "OutreachAgencyActivity_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "OutreachAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAgencyActivity" ADD CONSTRAINT "OutreachAgencyActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "OutreachAgencyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAgencyActivity" ADD CONSTRAINT "OutreachAgencyActivity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachEmailCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAgencyActivity" ADD CONSTRAINT "OutreachAgencyActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmailTemplate" ADD CONSTRAINT "OutreachEmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmailCampaign" ADD CONSTRAINT "OutreachEmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OutreachEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmailCampaign" ADD CONSTRAINT "OutreachEmailCampaign_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachOwner" ADD CONSTRAINT "OutreachOwner_convertedUserId_fkey" FOREIGN KEY ("convertedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachOwner" ADD CONSTRAINT "OutreachOwner_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachOwnerActivity" ADD CONSTRAINT "OutreachOwnerActivity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "OutreachOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachOwnerActivity" ADD CONSTRAINT "OutreachOwnerActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
