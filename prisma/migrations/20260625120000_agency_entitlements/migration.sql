-- Add FREE as the default agency plan and keep BASIC for the new paid middle tier.
ALTER TYPE "AgencyPlan" RENAME TO "AgencyPlan_old";
CREATE TYPE "AgencyPlan" AS ENUM ('FREE', 'BASIC', 'PREMIUM');
ALTER TABLE "Agency" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Agency" ALTER COLUMN "plan" TYPE "AgencyPlan"
USING (
    CASE
        WHEN "plan"::text = 'BASIC' THEN 'FREE'
        ELSE "plan"::text
    END
)::"AgencyPlan";
ALTER TABLE "Agency" ALTER COLUMN "plan" SET DEFAULT 'FREE';
DROP TYPE "AgencyPlan_old";

CREATE TABLE "AgencyEntitlementOverride" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyEntitlementOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyEntitlementOverride_agencyId_key_key" ON "AgencyEntitlementOverride"("agencyId", "key");
CREATE INDEX "AgencyEntitlementOverride_agencyId_idx" ON "AgencyEntitlementOverride"("agencyId");

ALTER TABLE "AgencyEntitlementOverride"
ADD CONSTRAINT "AgencyEntitlementOverride_agencyId_fkey"
FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
