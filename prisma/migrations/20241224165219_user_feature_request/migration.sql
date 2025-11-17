-- CreateTable
CREATE TABLE "UserFeatureRequest" (
    "id" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserFeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFeatureRequest_featureName_userId_key" ON "UserFeatureRequest"("featureName", "userId");

-- AddForeignKey
ALTER TABLE "UserFeatureRequest" ADD CONSTRAINT "UserFeatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
