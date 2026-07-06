ALTER TABLE "ClientSearch" ADD COLUMN "unsubscribeToken" TEXT;
ALTER TABLE "ClientSearch" ADD COLUMN "unsubscribedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "ClientSearch_unsubscribeToken_key" ON "ClientSearch"("unsubscribeToken");
