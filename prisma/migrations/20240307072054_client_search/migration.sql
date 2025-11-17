-- CreateTable
CREATE TABLE "ClientSearch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "filters" JSONB NOT NULL,

    CONSTRAINT "ClientSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSearch_userId_key" ON "ClientSearch"("userId");

-- AddForeignKey
ALTER TABLE "ClientSearch" ADD CONSTRAINT "ClientSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
