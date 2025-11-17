-- DropIndex
DROP INDEX "UserFeatureRequest_featureName_userId_key";

-- CreateIndex
CREATE INDEX "UserFeatureRequest_userId_idx" ON "UserFeatureRequest"("userId");
