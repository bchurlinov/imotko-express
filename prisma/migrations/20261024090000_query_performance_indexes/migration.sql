-- PERF(DB-02..04): query performance indexes, from the Supabase performance advisor (lints 0001/0005) and
-- pg_stat_statements (2026-10-23). Index-only change: no columns or data change, safe for imotko-express and the
-- mobile app. Mirrored byte-for-byte in imotko-express/prisma/migrations.
--
-- Plain CREATE INDEX (not CONCURRENTLY): Prisma runs the file as one batch, where CONCURRENTLY is not allowed. Every
-- table here is small (Property ~5k published rows), so each build takes well under a second and only blocks writes
-- to that table for that time.

-- PERF(DB-02): agency feed + agency counts (imotko-express: agency websites, mobile agency profile).
-- Query: WHERE "agencyId" = ? AND status = ? ORDER BY "bumpedAt" DESC NULLS LAST, "createdAt" DESC, "updatedAt" DESC
-- LIMIT ?, plus COUNT(*) WHERE "agencyId" = ? AND status = ?. Postgres now reads rows already in feed order and stops
-- at LIMIT instead of reading and sorting all of the agency's rows; the count is answered from the index alone.
-- HAND-EDITED: Prisma writes `"bumpedAt" DESC`, which in Postgres means NULLS FIRST and does not match the query's
-- NULLS LAST, so the planner would ignore the index for ordering. Prisma does not track NULLS FIRST/LAST, so the
-- schema's `bumpedAt(sort: Desc)` still matches this index (no drift).
-- Created before dropping Property_agencyId_idx, so agencyId lookups are never without an index.
CREATE INDEX "Property_agencyId_status_feed_idx" ON "Property"("agencyId", "status", "bumpedAt" DESC NULLS LAST, "createdAt" DESC, "updatedAt" DESC);

-- PERF(DB-02): replaced by Property_agencyId_status_feed_idx above (same leading column, still covers the agencyId FK).
DROP INDEX "Property_agencyId_idx";

-- PERF(DB-02): public feed (search page, capped map from DB-01). Same order and same NULLS LAST hand edit as above.
CREATE INDEX "Property_status_feed_idx" ON "Property"("status", "bumpedAt" DESC NULLS LAST, "createdAt" DESC, "updatedAt" DESC);

-- PERF(DB-03): unindexed foreign keys (Supabase lint 0001) that are on real read paths or cascade deletes.
-- Each one turns a full-table scan into an index lookup. Reasons are next to each @@index in prisma/schema.
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt" DESC);
CREATE INDEX "AgencyClient_agencyId_idx" ON "AgencyClient"("agencyId");
CREATE INDEX "AgencyClientNotes_agencyClientId_idx" ON "AgencyClientNotes"("agencyClientId");
CREATE INDEX "AgencyMember_agencyId_idx" ON "AgencyMember"("agencyId");
CREATE INDEX "AgencyReview_agencyId_idx" ON "AgencyReview"("agencyId");
CREATE INDEX "PropertySale_agencyId_idx" ON "PropertySale"("agencyId");
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
CREATE INDEX "Property_renterId_idx" ON "Property"("renterId");
CREATE INDEX "Property_createdByMemberId_idx" ON "Property"("createdByMemberId");
CREATE INDEX "PropertyEngagement_propertyId_idx" ON "PropertyEngagement"("propertyId");
CREATE INDEX "PropertySubmissionReview_propertyId_idx" ON "PropertySubmissionReview"("propertyId");
CREATE INDEX "ClientSearch_clientId_idx" ON "ClientSearch"("clientId");
CREATE INDEX "ClientPropertySubscription_clientId_idx" ON "ClientPropertySubscription"("clientId");
CREATE INDEX "ExpoPushTicket_tokenId_idx" ON "ExpoPushTicket"("tokenId");

-- PERF(DB-04): unused indexes (Supabase lint 0005) that only cost writes.
-- SearchQuery is a write-only log (nothing reads it), so this index was pure overhead on every logged search.
DROP INDEX "SearchQuery_location_listingType_category_idx";
-- Redundant: Lead_isActive_createdAt_idx, Lead_isActive_paidUnlockCount_idx and
-- Lead_isActive_sharedWithAgencies_createdAt_idx all start with isActive.
DROP INDEX "Lead_isActive_idx";
