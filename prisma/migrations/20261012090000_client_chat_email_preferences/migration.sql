-- AlterTable
-- Volatile default: Postgres fills a distinct token for every existing row.
ALTER TABLE "Client" ADD COLUMN     "chatEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatEmailsUnsubscribeToken" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;

-- CreateIndex
CREATE UNIQUE INDEX "Client_chatEmailsUnsubscribeToken_key" ON "Client"("chatEmailsUnsubscribeToken");
