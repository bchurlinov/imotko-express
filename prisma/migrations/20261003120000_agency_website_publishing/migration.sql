-- AlterTable
ALTER TABLE "AgencyWebsiteSettings" ADD COLUMN     "isLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AgencyWebsiteSettings_websiteUrl_key" ON "AgencyWebsiteSettings"("websiteUrl");

-- Backfill the agencies that were hardcoded in src/lib/dictionaries/agencies_with_websites.js.
-- The join on "Agency" skips ids that do not exist in this database.
INSERT INTO "AgencyWebsiteSettings" ("id", "agencyId", "serviceAreas", "websiteUrl", "isLive", "updatedAt")
SELECT gen_random_uuid()::text, a."id", ARRAY[]::TEXT[], v."websiteUrl", true, CURRENT_TIMESTAMP
FROM (
    VALUES
        ('cmaf9tbn60002k0047zsynv1n', 'https://delta.mk'),
        ('cm831eqy30001kw09ycobe848', 'https://zdraveski.mk'),
        ('cmhf5i5qg000cl104xzfhw5qv', 'https://dajanadoma.mk'),
        ('cm82xk78f0001l709p1oo0q1q', 'https://choice.com.mk')
) AS v("agencyId", "websiteUrl")
JOIN "Agency" a ON a."id" = v."agencyId"
ON CONFLICT ("agencyId") DO UPDATE
SET "websiteUrl" = EXCLUDED."websiteUrl", "isLive" = true, "updatedAt" = CURRENT_TIMESTAMP;
