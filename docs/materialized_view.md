-- ============================================================
-- FIX 1: mv_price_per_sqm
-- Bugs fixed:
--   a) Removed size > 0 from WHERE (was excluding for_rent with no size)
--   b) Added status = 'PUBLISHED' filter
--   c) Added "parentLocationId" for Skopje-level rollup
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_price_per_sqm;

CREATE MATERIALIZED VIEW mv_price_per_sqm AS
SELECT
p."propertyLocationId",
loc."parentId" AS "parentLocationId",
p."listingType",
p.type AS property_type,
COUNT(*)::INTEGER AS listing_count,
AVG(p.price)::INTEGER AS avg_price,
MIN(p.price) AS min_price,
MAX(p.price) AS max_price,
AVG(CASE WHEN p.size > 0 THEN p.size END)::INTEGER AS avg_size,
(SUM(CASE WHEN p.size > 0 THEN p.price END)::NUMERIC
/ NULLIF(SUM(CASE WHEN p.size > 0 THEN p.size END), 0)::NUMERIC
)::INTEGER AS avg_price_per_sqm
FROM "Property" p
LEFT JOIN "PropertyLocation" loc ON loc.id = p."propertyLocationId"
WHERE
p.price > 1
AND p."propertyLocationId" IS NOT NULL
AND p.status = 'PUBLISHED'
GROUP BY
p."propertyLocationId",
loc."parentId",
p."listingType",
p.type;

CREATE UNIQUE INDEX idx_mv_price_per_sqm_unique
ON mv_price_per_sqm ("propertyLocationId", "listingType", property_type);

-- ============================================================
-- FIX 2: mv_property_views_by_location
-- Bugs fixed:
--   a) Added "parentLocationId" for Skopje-level rollup
--   b) Added status = 'PUBLISHED' filter
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_property_views_by_location;

CREATE MATERIALIZED VIEW mv_property_views_by_location AS
SELECT
p."propertyLocationId",
loc."parentId" AS "parentLocationId",
p."listingType",
COUNT(pv.id)::INTEGER AS total_views,
COUNT(DISTINCT pv."propertyId")::INTEGER AS distinct_properties_viewed,
(COUNT(pv.id)::NUMERIC / NULLIF(COUNT(DISTINCT pv."propertyId"), 0)::NUMERIC)::NUMERIC(10,1) AS avg_views_per_property,
MIN(pv."viewDate") AS first_view_date,
MAX(pv."viewDate") AS last_view_date
FROM "PropertyView" pv
JOIN "Property" p ON pv."propertyId" = p.id
LEFT JOIN "PropertyLocation" loc ON loc.id = p."propertyLocationId"
WHERE
p."propertyLocationId" IS NOT NULL
AND p.status = 'PUBLISHED'
GROUP BY
p."propertyLocationId",
loc."parentId",
p."listingType";

CREATE UNIQUE INDEX idx_mv_property_views_by_location_unique
ON mv_property_views_by_location ("propertyLocationId", "listingType");

-- ============================================================
-- FIX 3: mv_market_trend_analysis
-- Bugs fixed:
--   a) Removed size > 0 from WHERE (was excluding for_rent with no size)
--   b) Added status = 'PUBLISHED' filter
--   c) Added "parentLocationId" for Skopje-level rollup
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_market_trend_analysis;

CREATE MATERIALIZED VIEW mv_market_trend_analysis AS
WITH cleaned_data AS (
SELECT
DATE_TRUNC('month', p."createdAt") AS month,
p."propertyLocationId",
loc."parentId" AS "parentLocationId",
p."listingType",
p.type AS property_type,
p.price,
p.size
FROM "Property" p
LEFT JOIN "PropertyLocation" loc ON loc.id = p."propertyLocationId"
WHERE
p.price > 1
AND p."createdAt" IS NOT NULL
AND p."propertyLocationId" IS NOT NULL
AND p.status = 'PUBLISHED'
),
monthly_aggregates AS (
SELECT
month,
"propertyLocationId",
"parentLocationId",
"listingType",
property_type,
COUNT(*)::INTEGER AS listing_count,
AVG(price)::INTEGER AS avg_price,
(SUM(CASE WHEN size > 0 THEN price END)::NUMERIC
/ NULLIF(SUM(CASE WHEN size > 0 THEN size END), 0)::NUMERIC
)::INTEGER AS avg_price_per_sqm
FROM cleaned_data
GROUP BY month, "propertyLocationId", "parentLocationId", "listingType", property_type
),
trend_calculations AS (
SELECT
*,
LAG(avg_price, 1) OVER w AS prev_month_price,
LAG(avg_price_per_sqm, 1) OVER w AS prev_month_sqm,
LAG(avg_price, 12) OVER w AS prev_year_price,
LAG(avg_price_per_sqm, 12) OVER w AS prev_year_sqm,
month = DATE_TRUNC('month', NOW()) AS is_partial_month
FROM monthly_aggregates
WINDOW w AS (
PARTITION BY "propertyLocationId", "listingType", property_type
ORDER BY month
)
)
SELECT
month,
listing_count,
is_partial_month,
"propertyLocationId",
"parentLocationId",
"listingType",
property_type,
avg_price,
ROUND(
(avg_price - prev_year_price)::NUMERIC / NULLIF(prev_year_price, 0)::NUMERIC * 100, 2
) AS yoy_change_price,
CASE
WHEN prev_month_price IS NULL THEN 'new'
WHEN avg_price::NUMERIC > (prev_month_price::NUMERIC * 1.02) THEN 'increasing'
WHEN avg_price::NUMERIC < (prev_month_price::NUMERIC * 0.98) THEN 'decreasing'
ELSE 'stable'
END AS trend_price,
avg_price_per_sqm,
ROUND(
(avg_price_per_sqm - prev_year_sqm)::NUMERIC / NULLIF(prev_year_sqm, 0)::NUMERIC * 100, 2
) AS yoy_change_sqm,
CASE
WHEN prev_month_sqm IS NULL THEN 'new'
WHEN avg_price_per_sqm::NUMERIC > (prev_month_sqm::NUMERIC * 1.02) THEN 'increasing'
WHEN avg_price_per_sqm::NUMERIC < (prev_month_sqm::NUMERIC * 0.98) THEN 'decreasing'
ELSE 'stable'
END AS trend_sqm
FROM trend_calculations;

CREATE UNIQUE INDEX idx_mv_market_trend_analysis_unique
ON mv_market_trend_analysis (month, "propertyLocationId", "listingType", property_type);