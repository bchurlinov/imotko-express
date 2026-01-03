-- =========================================================
-- 1. MATERIALIZED VIEW: mv_price_per_sqm
-- =========================================================

DROP MATERIALIZED VIEW IF EXISTS mv_price_per_sqm CASCADE;

CREATE MATERIALIZED VIEW mv_price_per_sqm AS
SELECT
"propertyLocationId",
"listingType",
"type" AS property_type,

    -- Metadata
    COUNT(*)::INTEGER AS listing_count,
    
    -- Price Stats
    AVG(price)::INTEGER AS avg_price,
    MIN(price)::INTEGER AS min_price,
    MAX(price)::INTEGER AS max_price,

    -- Size Stats
    AVG(size)::INTEGER AS avg_size,

    -- Price Per Sqm Stats (Weighted Average)
    (SUM(price)::DECIMAL / NULLIF(SUM(size), 0))::INTEGER AS avg_price_per_sqm

FROM "Property"
WHERE
price > 1         
AND size > 0      
AND "propertyLocationId" IS NOT NULL
GROUP BY
"propertyLocationId",
"listingType",
"type";

CREATE UNIQUE INDEX idx_mv_price_per_sqm_unique
ON mv_price_per_sqm ("propertyLocationId", "listingType", property_type);


-- =========================================================
-- 2. MATERIALIZED VIEW: mv_market_trend_analysis
-- =========================================================

DROP MATERIALIZED VIEW IF EXISTS mv_market_trend_analysis CASCADE;

CREATE MATERIALIZED VIEW mv_market_trend_analysis AS
WITH cleaned_data AS (
SELECT
DATE_TRUNC('month', "createdAt") AS month,
"propertyLocationId",
"listingType",
"type" AS property_type,
price,
size
FROM "Property"
WHERE
price > 1
AND size > 0
AND "createdAt" IS NOT NULL
AND "propertyLocationId" IS NOT NULL
),
monthly_aggregates AS (
SELECT
month,
"propertyLocationId",
"listingType",
property_type,
COUNT(*)::INTEGER AS listing_count,
AVG(price)::INTEGER AS avg_price,
(SUM(price)::DECIMAL / NULLIF(SUM(size), 0))::INTEGER AS avg_price_per_sqm
FROM cleaned_data
GROUP BY 1, 2, 3, 4
),
trend_calculations AS (
SELECT
*,
-- Previous Month Metrics
LAG(avg_price, 1) OVER w AS prev_month_price,
LAG(avg_price_per_sqm, 1) OVER w AS prev_month_sqm,

        -- Previous Year Metrics
        LAG(avg_price, 12) OVER w AS prev_year_price,
        LAG(avg_price_per_sqm, 12) OVER w AS prev_year_sqm,

        -- Helper flag
        (month = DATE_TRUNC('month', NOW())) AS is_partial_month

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
"listingType",
property_type,

    -- Price Analysis
    avg_price,
    ROUND(((avg_price - prev_year_price)::DECIMAL / NULLIF(prev_year_price, 0)) * 100, 2) AS yoy_change_price,
    CASE 
        WHEN prev_month_price IS NULL THEN 'new' 
        WHEN avg_price > prev_month_price * 1.02 THEN 'increasing'
        WHEN avg_price < prev_month_price * 0.98 THEN 'decreasing'
        ELSE 'stable'
    END AS trend_price,

    -- Sqm Analysis
    avg_price_per_sqm,
    ROUND(((avg_price_per_sqm - prev_year_sqm)::DECIMAL / NULLIF(prev_year_sqm, 0)) * 100, 2) AS yoy_change_sqm,
    CASE 
        WHEN prev_month_sqm IS NULL THEN 'new' 
        WHEN avg_price_per_sqm > prev_month_sqm * 1.02 THEN 'increasing'
        WHEN avg_price_per_sqm < prev_month_sqm * 0.98 THEN 'decreasing'
        ELSE 'stable'
    END AS trend_sqm

FROM trend_calculations;

CREATE UNIQUE INDEX idx_mv_market_trend_analysis_unique
ON mv_market_trend_analysis (month, "propertyLocationId", "listingType", property_type);


-- =========================================================
-- 3. MATERIALIZED VIEW: mv_property_views_by_location
-- =========================================================

DROP MATERIALIZED VIEW IF EXISTS mv_property_views_by_location CASCADE;

CREATE MATERIALIZED VIEW mv_property_views_by_location AS
SELECT
p."propertyLocationId",
p."listingType",

    COUNT(pv.id)::INTEGER AS total_views,
    COUNT(DISTINCT pv."propertyId")::INTEGER AS distinct_properties_viewed,
    (COUNT(pv.id)::DECIMAL / NULLIF(COUNT(DISTINCT pv."propertyId"), 0))::DECIMAL(10,1) AS avg_views_per_property,

    MIN(pv."viewDate") AS first_view_date,
    MAX(pv."viewDate") AS last_view_date

FROM "PropertyView" pv
JOIN "Property" p ON pv."propertyId" = p.id
WHERE
p."propertyLocationId" IS NOT NULL
GROUP BY
p."propertyLocationId",
p."listingType";

CREATE UNIQUE INDEX idx_mv_property_views_location_unique
ON mv_property_views_by_location ("propertyLocationId", "listingType");


-- =========================================================
-- 4. MATERIALIZED VIEW: mv_property_views_per_listing
-- =========================================================

DROP MATERIALIZED VIEW IF EXISTS mv_property_views_per_listing CASCADE;

CREATE MATERIALIZED VIEW mv_property_views_per_listing AS
SELECT
    DATE_TRUNC('month', "viewDate") AS month,
    "propertyId",
    COUNT(*)::INTEGER AS view_count
FROM "PropertyView"
WHERE "viewDate" IS NOT NULL
GROUP BY
    DATE_TRUNC('month', "viewDate"),
    "propertyId";

CREATE INDEX idx_mv_property_views_per_listing_property
ON mv_property_views_per_listing ("propertyId", month);

CREATE INDEX idx_mv_property_views_per_listing_month
ON mv_property_views_per_listing (month);