-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('AGENCY_INQUIRY', 'PRIVATE_INQUIRY', 'AGENCY_OUTREACH');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING_REVIEW', 'DELIVERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessagingFlagReason" AS ENUM ('AUTO_THRESHOLD', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "messagingFlagReason" "MessagingFlagReason",
ADD COLUMN     "messagingFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "messagingFlaggedAt" TIMESTAMPTZ(3),
ADD COLUMN     "messagingFlaggedById" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertySnapshot" JSONB,
    "lastDeliveredAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "agencyId" TEXT,
    "assignedMemberId" TEXT,
    "displayName" TEXT NOT NULL,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "firstUnreadAt" TIMESTAMPTZ(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastRemindedAt" TIMESTAMPTZ(3),
    "lastReadAt" TIMESTAMPTZ(3),
    "lastReadByMemberId" TEXT,
    "blockedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderParticipantId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'USER',
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'DELIVERED',
    "deliveredAt" TIMESTAMPTZ(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reporterParticipantId" TEXT NOT NULL,
    "reason" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_dedupeKey_key" ON "Conversation"("dedupeKey");

-- CreateIndex
CREATE INDEX "Conversation_lastDeliveredAt_idx" ON "Conversation"("lastDeliveredAt");

-- CreateIndex
CREATE INDEX "Conversation_propertyId_idx" ON "Conversation"("propertyId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_unreadCount_idx" ON "ConversationParticipant"("userId", "unreadCount");

-- CreateIndex
CREATE INDEX "ConversationParticipant_agencyId_unreadCount_idx" ON "ConversationParticipant"("agencyId", "unreadCount");

-- CreateIndex
CREATE INDEX "ConversationParticipant_unreadCount_reminderCount_firstUnre_idx" ON "ConversationParticipant"("unreadCount", "reminderCount", "firstUnreadAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_agencyId_key" ON "ConversationParticipant"("conversationId", "agencyId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_status_createdAt_idx" ON "Message"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderUserId_createdAt_idx" ON "Message"("senderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationReport_resolvedAt_idx" ON "ConversationReport"("resolvedAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_lastReadByMemberId_fkey" FOREIGN KEY ("lastReadByMemberId") REFERENCES "AgencyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderParticipantId_fkey" FOREIGN KEY ("senderParticipantId") REFERENCES "ConversationParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_reporterParticipantId_fkey" FOREIGN KEY ("reporterParticipantId") REFERENCES "ConversationParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
