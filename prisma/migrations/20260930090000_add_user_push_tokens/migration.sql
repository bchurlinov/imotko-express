-- AlterEnum
ALTER TYPE "UserLanguage" ADD VALUE IF NOT EXISTS 'TR';

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "PushLocale" AS ENUM ('mk', 'en', 'sq', 'tr');

-- CreateTable
CREATE TABLE "UserPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "locale" "PushLocale" NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPushToken_token_key" ON "UserPushToken"("token");

-- CreateIndex
CREATE INDEX "UserPushToken_userId_idx" ON "UserPushToken"("userId");

-- CreateTable
CREATE TABLE "ExpoPushTicket" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "receiptCheckedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpoPushTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpoPushTicket_ticketId_key" ON "ExpoPushTicket"("ticketId");

-- CreateIndex
CREATE INDEX "ExpoPushTicket_receiptCheckedAt_createdAt_idx" ON "ExpoPushTicket"("receiptCheckedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPushToken" ADD CONSTRAINT "UserPushToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpoPushTicket" ADD CONSTRAINT "ExpoPushTicket_tokenId_fkey"
FOREIGN KEY ("tokenId") REFERENCES "UserPushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
