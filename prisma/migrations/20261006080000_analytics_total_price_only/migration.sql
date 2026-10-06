-- Price analytics compare total listing prices only. Per-night and per-square-meter
-- values use different units and must not contribute to the same aggregates.

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
    (
        SUM(CASE WHEN p.size > 0 THEN p.price END)::NUMERIC
        / NULLIF(SUM(CASE WHEN p.size > 0 THEN p.size END), 0)::NUMERIC
    )::INTEGER AS avg_price_per_sqm
FROM "Property" p
LEFT JOIN "PropertyLocation" loc ON loc.id = p."propertyLocationId"
WHERE
    p.price > 1
    AND p."propertyLocationId" IS NOT NULL
    AND p.status = 'PUBLISHED'
    AND p."priceUnit" = 'TOTAL'
GROUP BY
    p."propertyLocationId",
    loc."parentId",
    p."listingType",
    p.type;

CREATE UNIQUE INDEX idx_mv_price_per_sqm_unique
ON mv_price_per_sqm ("propertyLocationId", "listingType", property_type);

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
        AND p."priceUnit" = 'TOTAL'
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
        (
            SUM(CASE WHEN size > 0 THEN price END)::NUMERIC
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
        (avg_price - prev_year_price)::NUMERIC / NULLIF(prev_year_price, 0)::NUMERIC * 100,
        2
    ) AS yoy_change_price,
    CASE
        WHEN prev_month_price IS NULL THEN 'new'
        WHEN avg_price::NUMERIC > (prev_month_price::NUMERIC * 1.02) THEN 'increasing'
        WHEN avg_price::NUMERIC < (prev_month_price::NUMERIC * 0.98) THEN 'decreasing'
        ELSE 'stable'
    END AS trend_price,
    avg_price_per_sqm,
    ROUND(
        (avg_price_per_sqm - prev_year_sqm)::NUMERIC / NULLIF(prev_year_sqm, 0)::NUMERIC * 100,
        2
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
