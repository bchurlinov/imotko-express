-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "removed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a side removed the conversation when it sent the removal SYSTEM message.
UPDATE "ConversationParticipant" AS p
SET "removed" = true
WHERE EXISTS (
    SELECT 1
    FROM "Message" AS m
    WHERE m."conversationId" = p."conversationId"
      AND m."senderParticipantId" = p."id"
      AND m."kind" = 'SYSTEM'
      AND m."bodyText" IN ('clientRemovedConversation', 'agencyRemovedConversation')
);
