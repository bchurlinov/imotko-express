-- Interpret existing naive publication timestamps as UTC and store future values with timezone awareness.
ALTER TABLE "Property"
ALTER COLUMN "facebookPublishedAt" TYPE TIMESTAMPTZ(3)
USING "facebookPublishedAt" AT TIME ZONE 'UTC';
