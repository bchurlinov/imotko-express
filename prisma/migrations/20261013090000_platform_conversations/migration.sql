-- AlterEnum
ALTER TYPE "ConversationKind" ADD VALUE 'PLATFORM_SUPPORT';
ALTER TYPE "ConversationKind" ADD VALUE 'PLATFORM_TOPIC';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "subject" TEXT;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "isPlatform" BOOLEAN NOT NULL DEFAULT false;
