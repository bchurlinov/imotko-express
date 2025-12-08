display in the charts. Since this application is for real estate I find this as a good option to implement.I have the Property model in
@prisma/schema/property.prisma and I was suggested to do CREATE MATERIALIZED VIEW property_stats AS
SELECT
-- basic counts
COUNT(\*) AS total,

-- group by listing type (rent/sale)
COUNT(_) FILTER (WHERE p."listingType" = 'for_rent') AS total_rent,
COUNT(_) FILTER (WHERE p."listingType" = 'for_sale') AS total_sale,

-- featured
COUNT(\*) FILTER (WHERE p."featured" = TRUE) AS total_featured,

-- by type
COUNT(_) FILTER (WHERE p."type" = 'flat') AS total_flats,
COUNT(_) FILTER (WHERE p."type" = 'house') AS total_houses,
COUNT(\*) FILTER (WHERE p."type" = 'land') AS total_land,

-- averages
AVG(p.price) AS avg_price,
AVG(p.size) AS avg_size,

-- location data
l.city,
l.municipality,

-- time grouping
MIN(p."createdAt") AS first_listing,
MAX(p."createdAt") AS last_listing

FROM "Property" p
LEFT JOIN "PropertyLocation" l
ON p."propertyLocationId" = l.id
GROUP BY l.city, l.municipality;. What do you think of this implmenetation on the longer run and is it scalable and maintanable?
⎿ Read prisma/schema/property.prisma (205 lines)

⏺ Looking at your schema and the proposed materialized view, I see a few issues and have some thoughts:

Schema Mismatch

The proposed SQL references l.city and l.municipality, but your PropertyLocation model only has:

- id, name, parentId, and relations

There are no city or municipality columns. The location appears to use a hierarchical parent-child structure instead.

Analysis of the Approach

Pros:

- Materialized views are good for read-heavy analytics dashboards
- Pre-computed aggregates avoid expensive COUNT/AVG queries on every request
- PostgreSQL handles refresh efficiently with REFRESH MATERIALIZED VIEW CONCURRENTLY

Concerns:

1. Staleness - You need a refresh strategy. Options:
    - Scheduled (cron job every X minutes)
    - Trigger-based (after inserts/updates)
    - On-demand before dashboard loads

2. Grouping by location - With your hierarchical PropertyLocation model, grouping becomes complex. You'd need to flatten the hierarchy or decide
   at which level to aggregate.
3. Missing dimensions - For real estate analytics, you likely want:
    - Time-based groupings (monthly/quarterly trends)
    - Status filtering (only PUBLISHED properties?)
    - Agency-level stats
    - Price ranges/buckets

4. Prisma limitations - Prisma doesn't natively support materialized views. You'd need:
    - Raw SQL migrations to create/refresh
    - Raw queries to read from them
    - Manual type definitions

Recommended Approach

A more flexible version:

CREATE MATERIALIZED VIEW property*stats AS
SELECT
COUNT(*) AS total,
COUNT(_) FILTER (WHERE "listingType" = 'for_rent') AS total_rent,
COUNT(_) FILTER (WHERE "listingType" = 'for*sale') AS total_sale,
COUNT(*) FILTER (WHERE "featured" = TRUE) AS total*featured,
COUNT(*) FILTER (WHERE "type" = 'flat') AS total*flats,
COUNT(*) FILTER (WHERE "type" = 'house') AS total*houses,
COUNT(*) FILTER (WHERE "type" = 'land') AS total*land,
COUNT(*) FILTER (WHERE "type" = 'holiday*home') AS total_holiday_homes,
COUNT(*) FILTER (WHERE "type" = 'garage') AS total*garages,
COUNT(*) FILTER (WHERE "type" = 'commercial') AS total_commercial,
AVG(price)::integer AS avg_price,
AVG(size)::integer AS avg_size,
"propertyLocationId",
"agencyId",
DATE_TRUNC('month', "createdAt") AS month,
"status"
FROM "Property"
WHERE "status" = 'PUBLISHED'
GROUP BY "propertyLocationId", "agencyId", DATE_TRUNC('month', "createdAt"), "status";

CREATE UNIQUE INDEX ON property_stats ("propertyLocationId", "agencyId", month, "status");

The unique index enables REFRESH MATERIALIZED VIEW CONCURRENTLY (non-blocking refresh).

Is It Worth It?

Use materialized view if:

- Dashboard queries are slow (100ms+)
- You have 10k+ properties
- Stats are viewed frequently but don't need real-time accuracy

Skip materialized view if:

- Under 10k properties (regular queries with proper indexes are fast enough)
- You need real-time data
- Stats change frequently and staleness is unacceptable

Would you like me to help implement this with the correct schema structure, including the migration and service layer?

> I have around 4000 properties right now and I was thinking of showing these 3 charts: 1. Price trends (you already have)

Monthly avg price is perfect.

👉 Enhance it:
• add YOY % change
• show “last 12 months”
• trend arrows (up/down)

⸻

⭐ 2. Price per m²

Most real estate buyers care more about €/m² than total price.

Example:
• Avg price
• Avg price per m²
• by city
• by property type

Chart type: Bar chart or line chart

⸻

⭐ 3. Demand (property views)

Since you track views — that’s gold.

Show:
• Total views per month
• Views per city
• Views per category
• Views on a specific listing

⏺ Good use case. With 4000 properties, you're at the threshold where materialized views start making sense, especially since PropertyView will
grow much faster (potentially 100k+ views).

Let me clarify a few things before implementing:

Quick Questions

1. Location Structure

Your PropertyLocation uses a hierarchical parent-child model. How is it structured?

- Country → City → Municipality → Neighborhood?
- Or something else?

This affects how we group "by city."

2. Time Range Preferences

For the charts, what time ranges do you need?

- Last 12 months only?
- Or also last 30 days, last 90 days, all-time?

3. Access Control

Should these stats be:

- Public (anyone can see aggregate market data)?
- Agency-specific (each agency sees only their own stats)?
- Admin-only?

Proposed Implementation

src/
├── api/v1/
│ ├── controllers/analytics/
│ │ └── analytics.controller.js
│ ├── routes/analytics/
│ │ └── analytics.routes.js
│ └── services/analytics/
│ └── analytics.service.js
prisma/
└── migrations/
└── XXXXXX_add_analytics_views/
└── migration.sql (materialized views + refresh function)

Endpoints:
GET /api/v1/analytics/price-trends → monthly avg, YOY change
GET /api/v1/analytics/price-per-sqm → by city, by type
GET /api/v1/analytics/demand → views aggregated
GET /api/v1/analytics/demand/:propertyId → views for specific listing

Materialized Views:

1. mv_price_trends - monthly price averages
2. mv_price_per_sqm - price/m² by location and type
3. mv_property_views - view counts aggregated

Refresh Strategy:

- Scheduled refresh via cron (every 15-30 min) or
- On-demand refresh endpoint for admin

Should I proceed with implementation once you clarify the location structure?

> 1. I store the city and each city can have municipality and that's it. Most cities are single and some like Skopje in North Macedonia can have
>    Karposh, Aerodrom etc. 2. For the time range We could add last year, last month, last 3 months, last 6 months up to a year.3. This information is public.
