# Analytics Implementation Plan

This document outlines the implementation plan for the analytics feature using PostgreSQL materialized views.

## Overview

Based on the requirements from `materialized.md`, this feature will provide:

1. **Price Trends** - Monthly average prices with YoY change and trend indicators
2. **Price per m²** - Price per square meter by city and property type
3. **Demand Analytics** - Property view statistics aggregated by various dimensions

## Current State

- ~4,000 properties in the database
- `PropertyView` table tracks individual views (expected to grow significantly)
- `PropertyLocation` uses hierarchical parent-child model (city → municipality)
- Time ranges needed: last month, 3 months, 6 months, 1 year

## Implementation Steps

### Step 1: Database Migration - Create Materialized Views

Create a new Prisma migration with raw SQL for the materialized views.

**File:** `prisma/migrations/XXXXXX_add_analytics_materialized_views/migration.sql`

```sql
-- Materialized View 1: Price Trends (Monthly Aggregates)
CREATE MATERIALIZED VIEW mv_price_trends AS
SELECT
    DATE_TRUNC('month', "createdAt") AS month,
    "propertyLocationId",
    "listingType",
    "type" AS property_type,
    COUNT(*) AS listing_count,
    AVG(price)::INTEGER AS avg_price,
    MIN(price) AS min_price,
    MAX(price) AS max_price,
    AVG(CASE WHEN size > 0 THEN price::DECIMAL / size END)::INTEGER AS avg_price_per_sqm
FROM "Property"
WHERE "status" = 'PUBLISHED'
GROUP BY
    DATE_TRUNC('month', "createdAt"),
    "propertyLocationId",
    "listingType",
    "type";

CREATE UNIQUE INDEX idx_mv_price_trends_unique
ON mv_price_trends (month, "propertyLocationId", "listingType", property_type);

CREATE INDEX idx_mv_price_trends_month ON mv_price_trends (month);
CREATE INDEX idx_mv_price_trends_location ON mv_price_trends ("propertyLocationId");

-- Materialized View 2: Price Per Square Meter (By Location and Type)
CREATE MATERIALIZED VIEW mv_price_per_sqm AS
SELECT
    "propertyLocationId",
    "listingType",
    "type" AS property_type,
    COUNT(*) AS listing_count,
    AVG(price)::INTEGER AS avg_price,
    AVG(size)::INTEGER AS avg_size,
    AVG(CASE WHEN size > 0 THEN price::DECIMAL / size END)::INTEGER AS avg_price_per_sqm,
    MIN(CASE WHEN size > 0 THEN price::DECIMAL / size END)::INTEGER AS min_price_per_sqm,
    MAX(CASE WHEN size > 0 THEN price::DECIMAL / size END)::INTEGER AS max_price_per_sqm
FROM "Property"
WHERE "status" = 'PUBLISHED' AND size > 0
GROUP BY "propertyLocationId", "listingType", "type";

CREATE UNIQUE INDEX idx_mv_price_per_sqm_unique
ON mv_price_per_sqm ("propertyLocationId", "listingType", property_type);

-- Materialized View 3: Property Views (Demand Analytics)
CREATE MATERIALIZED VIEW mv_property_views AS
SELECT
    DATE_TRUNC('month', pv."viewDate") AS month,
    p."propertyLocationId",
    p."listingType",
    p."type" AS property_type,
    p."categoryId",
    COUNT(*) AS view_count,
    COUNT(DISTINCT pv."propertyId") AS unique_properties_viewed
FROM "PropertyView" pv
JOIN "Property" p ON pv."propertyId" = p.id
WHERE p."status" = 'PUBLISHED'
GROUP BY
    DATE_TRUNC('month', pv."viewDate"),
    p."propertyLocationId",
    p."listingType",
    p."type",
    p."categoryId";

CREATE UNIQUE INDEX idx_mv_property_views_unique
ON mv_property_views (month, "propertyLocationId", "listingType", property_type, "categoryId");

CREATE INDEX idx_mv_property_views_month ON mv_property_views (month);
CREATE INDEX idx_mv_property_views_location ON mv_property_views ("propertyLocationId");

-- Materialized View 4: Property Views Per Listing (for individual property stats)
CREATE MATERIALIZED VIEW mv_property_views_per_listing AS
SELECT
    "propertyId",
    DATE_TRUNC('month', "viewDate") AS month,
    COUNT(*) AS view_count
FROM "PropertyView"
GROUP BY "propertyId", DATE_TRUNC('month', "viewDate");

CREATE UNIQUE INDEX idx_mv_property_views_per_listing_unique
ON mv_property_views_per_listing ("propertyId", month);

-- Function to refresh all analytics views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_price_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_price_per_sqm;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_views;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_views_per_listing;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Create Analytics Service

**File:** `src/api/v1/services/analytics/analytics.service.js`

```javascript
import prisma from "#database/client.js"

/**
 * @typedef {Object} TimeRange
 * @property {'1m' | '3m' | '6m' | '1y'} range
 */

/**
 * @typedef {Object} PriceTrendItem
 * @property {string} month
 * @property {number} avg_price
 * @property {number} avg_price_per_sqm
 * @property {number} listing_count
 * @property {number | null} yoy_change_percent
 */

/**
 * Get date filter based on time range
 * @param {'1m' | '3m' | '6m' | '1y'} range
 * @returns {Date}
 */
const getStartDate = (range) => {
    const now = new Date()
    switch (range) {
        case '1m': return new Date(now.setMonth(now.getMonth() - 1))
        case '3m': return new Date(now.setMonth(now.getMonth() - 3))
        case '6m': return new Date(now.setMonth(now.getMonth() - 6))
        case '1y':
        default: return new Date(now.setFullYear(now.getFullYear() - 1))
    }
}

/**
 * Get price trends with YoY comparison
 * @param {Object} params
 * @param {string} [params.locationId]
 * @param {string} [params.listingType]
 * @param {string} [params.propertyType]
 * @param {'1m' | '3m' | '6m' | '1y'} [params.range='1y']
 * @returns {Promise<{success: boolean, data?: PriceTrendItem[], error?: string}>}
 */
export const getPriceTrendsService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, range = '1y' } = params
        const startDate = getStartDate(range)

        // Get start date for YoY comparison (1 year before the range start)
        const yoyStartDate = new Date(startDate)
        yoyStartDate.setFullYear(yoyStartDate.getFullYear() - 1)

        let whereClause = `WHERE month >= $1`
        const queryParams = [yoyStartDate]
        let paramIndex = 2

        if (locationId) {
            whereClause += ` AND "propertyLocationId" = $${paramIndex}`
            queryParams.push(locationId)
            paramIndex++
        }
        if (listingType) {
            whereClause += ` AND "listingType" = $${paramIndex}`
            queryParams.push(listingType)
            paramIndex++
        }
        if (propertyType) {
            whereClause += ` AND property_type = $${paramIndex}`
            queryParams.push(propertyType)
            paramIndex++
        }

        const results = await prisma.$queryRawUnsafe(`
            SELECT
                month,
                SUM(listing_count) AS listing_count,
                AVG(avg_price)::INTEGER AS avg_price,
                AVG(avg_price_per_sqm)::INTEGER AS avg_price_per_sqm
            FROM mv_price_trends
            ${whereClause}
            GROUP BY month
            ORDER BY month ASC
        `, ...queryParams)

        // Calculate YoY change for each month
        const dataWithYoY = results.map((item, _, arr) => {
            const yearAgo = new Date(item.month)
            yearAgo.setFullYear(yearAgo.getFullYear() - 1)

            const yearAgoData = arr.find(d =>
                new Date(d.month).getTime() === yearAgo.getTime()
            )

            let yoy_change_percent = null
            if (yearAgoData && yearAgoData.avg_price > 0) {
                yoy_change_percent = Math.round(
                    ((item.avg_price - yearAgoData.avg_price) / yearAgoData.avg_price) * 100
                )
            }

            return {
                ...item,
                yoy_change_percent,
                trend: yoy_change_percent > 0 ? 'up' : yoy_change_percent < 0 ? 'down' : 'stable'
            }
        }).filter(item => new Date(item.month) >= startDate)

        return { success: true, data: dataWithYoY }
    } catch (error) {
        console.error('getPriceTrendsService error:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get price per square meter statistics
 * @param {Object} params
 * @param {string} [params.locationId]
 * @param {string} [params.listingType]
 * @param {string} [params.propertyType]
 * @param {'city' | 'type'} [params.groupBy='city']
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getPricePerSqmService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, groupBy = 'city' } = params

        let whereConditions = []
        const queryParams = []
        let paramIndex = 1

        if (locationId) {
            whereConditions.push(`"propertyLocationId" = $${paramIndex}`)
            queryParams.push(locationId)
            paramIndex++
        }
        if (listingType) {
            whereConditions.push(`"listingType" = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        }
        if (propertyType) {
            whereConditions.push(`property_type = $${paramIndex}`)
            queryParams.push(propertyType)
            paramIndex++
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : ''

        const groupByField = groupBy === 'type' ? 'property_type' : '"propertyLocationId"'

        const results = await prisma.$queryRawUnsafe(`
            SELECT
                ${groupByField} AS group_key,
                SUM(listing_count) AS listing_count,
                AVG(avg_price)::INTEGER AS avg_price,
                AVG(avg_size)::INTEGER AS avg_size,
                AVG(avg_price_per_sqm)::INTEGER AS avg_price_per_sqm,
                MIN(min_price_per_sqm) AS min_price_per_sqm,
                MAX(max_price_per_sqm) AS max_price_per_sqm
            FROM mv_price_per_sqm
            ${whereClause}
            GROUP BY ${groupByField}
            ORDER BY avg_price_per_sqm DESC
        `, ...queryParams)

        // If grouped by location, fetch location names
        if (groupBy === 'city' && results.length > 0) {
            const locationIds = results.map(r => r.group_key).filter(Boolean)
            const locations = await prisma.propertyLocation.findMany({
                where: { id: { in: locationIds } },
                select: { id: true, name: true }
            })
            const locationMap = new Map(locations.map(l => [l.id, l.name]))

            results.forEach(r => {
                r.location_name = locationMap.get(r.group_key) || 'Unknown'
            })
        }

        return { success: true, data: results }
    } catch (error) {
        console.error('getPricePerSqmService error:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get demand analytics (property views)
 * @param {Object} params
 * @param {string} [params.locationId]
 * @param {string} [params.listingType]
 * @param {string} [params.propertyType]
 * @param {string} [params.categoryId]
 * @param {'1m' | '3m' | '6m' | '1y'} [params.range='1y']
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getDemandAnalyticsService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, categoryId, range = '1y' } = params
        const startDate = getStartDate(range)

        let whereConditions = [`month >= $1`]
        const queryParams = [startDate]
        let paramIndex = 2

        if (locationId) {
            whereConditions.push(`"propertyLocationId" = $${paramIndex}`)
            queryParams.push(locationId)
            paramIndex++
        }
        if (listingType) {
            whereConditions.push(`"listingType" = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        }
        if (propertyType) {
            whereConditions.push(`property_type = $${paramIndex}`)
            queryParams.push(propertyType)
            paramIndex++
        }
        if (categoryId) {
            whereConditions.push(`"categoryId" = $${paramIndex}`)
            queryParams.push(categoryId)
            paramIndex++
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`

        const results = await prisma.$queryRawUnsafe(`
            SELECT
                month,
                SUM(view_count) AS view_count,
                SUM(unique_properties_viewed) AS unique_properties_viewed
            FROM mv_property_views
            ${whereClause}
            GROUP BY month
            ORDER BY month ASC
        `, ...queryParams)

        return { success: true, data: results }
    } catch (error) {
        console.error('getDemandAnalyticsService error:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get views for a specific property
 * @param {string} propertyId
 * @param {'1m' | '3m' | '6m' | '1y'} [range='1y']
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getPropertyViewsService = async (propertyId, range = '1y') => {
    try {
        const startDate = getStartDate(range)

        const results = await prisma.$queryRaw`
            SELECT month, view_count
            FROM mv_property_views_per_listing
            WHERE "propertyId" = ${propertyId}
            AND month >= ${startDate}
            ORDER BY month ASC
        `

        // Also get total views
        const total = await prisma.$queryRaw`
            SELECT COALESCE(SUM(view_count), 0) AS total_views
            FROM mv_property_views_per_listing
            WHERE "propertyId" = ${propertyId}
        `

        return {
            success: true,
            data: {
                monthly: results,
                total_views: Number(total[0]?.total_views || 0)
            }
        }
    } catch (error) {
        console.error('getPropertyViewsService error:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Refresh all analytics materialized views (admin only)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const refreshAnalyticsViewsService = async () => {
    try {
        await prisma.$executeRaw`SELECT refresh_analytics_views()`
        return { success: true }
    } catch (error) {
        console.error('refreshAnalyticsViewsService error:', error)
        return { success: false, error: error.message }
    }
}
```

### Step 3: Create Analytics Controller

**File:** `src/api/v1/controllers/analytics/analytics.controller.js`

```javascript
import {
    getPriceTrendsService,
    getPricePerSqmService,
    getDemandAnalyticsService,
    getPropertyViewsService,
    refreshAnalyticsViewsService
} from "#services/analytics/analytics.service.js"

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getPriceTrendsController = async (req, res, next) => {
    try {
        const { locationId, listingType, propertyType, range } = req.query
        const result = await getPriceTrendsService({
            locationId, listingType, propertyType, range
        })

        if (!result.success) {
            return res.status(500).json({ error: result.error })
        }

        res.json(result.data)
    } catch (error) {
        next(error)
    }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getPricePerSqmController = async (req, res, next) => {
    try {
        const { locationId, listingType, propertyType, groupBy } = req.query
        const result = await getPricePerSqmService({
            locationId, listingType, propertyType, groupBy
        })

        if (!result.success) {
            return res.status(500).json({ error: result.error })
        }

        res.json(result.data)
    } catch (error) {
        next(error)
    }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getDemandAnalyticsController = async (req, res, next) => {
    try {
        const { locationId, listingType, propertyType, categoryId, range } = req.query
        const result = await getDemandAnalyticsService({
            locationId, listingType, propertyType, categoryId, range
        })

        if (!result.success) {
            return res.status(500).json({ error: result.error })
        }

        res.json(result.data)
    } catch (error) {
        next(error)
    }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getPropertyViewsController = async (req, res, next) => {
    try {
        const { id } = req.params
        const { range } = req.query
        const result = await getPropertyViewsService(id, range)

        if (!result.success) {
            return res.status(500).json({ error: result.error })
        }

        res.json(result.data)
    } catch (error) {
        next(error)
    }
}

/**
 * Admin endpoint to manually refresh analytics views
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const refreshAnalyticsController = async (req, res, next) => {
    try {
        const result = await refreshAnalyticsViewsService()

        if (!result.success) {
            return res.status(500).json({ error: result.error })
        }

        res.json({ message: 'Analytics views refreshed successfully' })
    } catch (error) {
        next(error)
    }
}
```

### Step 4: Create Analytics Routes

**File:** `src/api/v1/routes/analytics/analytics.routes.js`

```javascript
import { Router } from "express"
import { query, param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"
import {
    getPriceTrendsController,
    getPricePerSqmController,
    getDemandAnalyticsController,
    getPropertyViewsController,
    refreshAnalyticsController
} from "#controllers/analytics/analytics.controller.js"

const router = Router()

const rangeValidation = query('range')
    .optional()
    .isIn(['1m', '3m', '6m', '1y'])
    .withMessage('Range must be one of: 1m, 3m, 6m, 1y')

const listingTypeValidation = query('listingType')
    .optional()
    .isIn(['for_rent', 'for_sale'])
    .withMessage('listingType must be for_rent or for_sale')

const propertyTypeValidation = query('propertyType')
    .optional()
    .isIn(['flat', 'house', 'land', 'holiday_home', 'garage', 'commercial'])
    .withMessage('Invalid propertyType')

const groupByValidation = query('groupBy')
    .optional()
    .isIn(['city', 'type'])
    .withMessage('groupBy must be city or type')

// GET /api/v1/analytics/price-trends
router.get(
    '/price-trends',
    [
        rangeValidation,
        listingTypeValidation,
        propertyTypeValidation,
        query('locationId').optional().isString().trim()
    ],
    validateRequest,
    getPriceTrendsController
)

// GET /api/v1/analytics/price-per-sqm
router.get(
    '/price-per-sqm',
    [
        listingTypeValidation,
        propertyTypeValidation,
        groupByValidation,
        query('locationId').optional().isString().trim()
    ],
    validateRequest,
    getPricePerSqmController
)

// GET /api/v1/analytics/demand
router.get(
    '/demand',
    [
        rangeValidation,
        listingTypeValidation,
        propertyTypeValidation,
        query('locationId').optional().isString().trim(),
        query('categoryId').optional().isString().trim()
    ],
    validateRequest,
    getDemandAnalyticsController
)

// GET /api/v1/analytics/demand/:id (views for specific property)
router.get(
    '/demand/:id',
    [
        param('id').notEmpty().withMessage('Property ID is required').trim(),
        rangeValidation
    ],
    validateRequest,
    getPropertyViewsController
)

// POST /api/v1/analytics/refresh (admin only - requires authentication)
router.post(
    '/refresh',
    verifySupabaseToken,
    refreshAnalyticsController
)

export default router
```

### Step 5: Register Routes

**File:** `src/api/v1/routes/index.js` (update)

Add the analytics routes to the main router:

```javascript
import analyticsRoutes from "./analytics/analytics.routes.js"

// ... existing code ...

router.use("/analytics", analyticsRoutes)
```

### Step 6: Refresh Strategy

Create a scheduled job to refresh the materialized views. You can use `node-cron` or an external scheduler.

**Option A: Using node-cron (recommended for simplicity)**

**File:** `src/jobs/refreshAnalytics.js`

```javascript
import cron from 'node-cron'
import prisma from "#database/client.js"

// Refresh analytics views every 30 minutes
export const scheduleAnalyticsRefresh = () => {
    cron.schedule('*/30 * * * *', async () => {
        try {
            console.log('[Analytics] Refreshing materialized views...')
            await prisma.$executeRaw`SELECT refresh_analytics_views()`
            console.log('[Analytics] Materialized views refreshed successfully')
        } catch (error) {
            console.error('[Analytics] Failed to refresh views:', error)
        }
    })
}
```

**File:** `src/app.js` (update)

```javascript
import { scheduleAnalyticsRefresh } from './jobs/refreshAnalytics.js'

// ... existing code ...

// Start scheduled jobs (after app.listen)
if (process.env.NODE_ENV === 'production') {
    scheduleAnalyticsRefresh()
}
```

**Option B: External cron/scheduler (for production)**

Use pg_cron, a system cron job, or a cloud scheduler to call:
```sql
SELECT refresh_analytics_views();
```

## API Endpoints Summary

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/analytics/price-trends` | GET | Monthly price trends with YoY | Public |
| `/api/v1/analytics/price-per-sqm` | GET | Price per m² by city/type | Public |
| `/api/v1/analytics/demand` | GET | Aggregated view statistics | Public |
| `/api/v1/analytics/demand/:id` | GET | Views for specific property | Public |
| `/api/v1/analytics/refresh` | POST | Manually refresh views | Admin |

## Query Parameters

### Common Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `range` | `1m`, `3m`, `6m`, `1y` | Time range filter |
| `locationId` | string | Filter by location ID |
| `listingType` | `for_rent`, `for_sale` | Filter by listing type |
| `propertyType` | `flat`, `house`, `land`, etc. | Filter by property type |

### Endpoint-Specific Parameters

- **`/price-per-sqm`**: `groupBy` (`city` or `type`)
- **`/demand`**: `categoryId` (filter by property category)

## Example API Responses

### GET /api/v1/analytics/price-trends?range=1y&listingType=for_sale

```json
[
    {
        "month": "2024-01-01T00:00:00.000Z",
        "listing_count": 150,
        "avg_price": 85000,
        "avg_price_per_sqm": 1200,
        "yoy_change_percent": 5,
        "trend": "up"
    },
    {
        "month": "2024-02-01T00:00:00.000Z",
        "listing_count": 165,
        "avg_price": 87000,
        "avg_price_per_sqm": 1230,
        "yoy_change_percent": 8,
        "trend": "up"
    }
]
```

### GET /api/v1/analytics/price-per-sqm?groupBy=city&listingType=for_sale

```json
[
    {
        "group_key": "clxxx123",
        "location_name": "Skopje",
        "listing_count": 500,
        "avg_price": 95000,
        "avg_size": 75,
        "avg_price_per_sqm": 1267,
        "min_price_per_sqm": 800,
        "max_price_per_sqm": 2500
    },
    {
        "group_key": "clxxx456",
        "location_name": "Bitola",
        "listing_count": 120,
        "avg_price": 45000,
        "avg_size": 80,
        "avg_price_per_sqm": 563,
        "min_price_per_sqm": 400,
        "max_price_per_sqm": 900
    }
]
```

## File Structure

```
src/
├── api/v1/
│   ├── controllers/
│   │   └── analytics/
│   │       └── analytics.controller.js
│   ├── routes/
│   │   ├── analytics/
│   │   │   └── analytics.routes.js
│   │   └── index.js (update)
│   └── services/
│       └── analytics/
│           └── analytics.service.js
├── jobs/
│   └── refreshAnalytics.js
└── app.js (update)

prisma/
└── migrations/
    └── XXXXXX_add_analytics_materialized_views/
        └── migration.sql
```

## Dependencies

Add `node-cron` for scheduled refresh (optional):

```bash
npm install node-cron
```

## Implementation Order

1. Create the migration file with materialized views
2. Run `npx prisma migrate dev` to apply the migration
3. Create the analytics service file
4. Create the analytics controller file
5. Create the analytics routes file
6. Update `src/api/v1/routes/index.js` to include analytics routes
7. (Optional) Set up the scheduled refresh job
8. Test all endpoints

## Considerations

### Performance

- With 4,000 properties, query performance should be good
- PropertyView table will grow faster - materialized views help here
- Unique indexes enable `REFRESH MATERIALIZED VIEW CONCURRENTLY` (non-blocking)

### Data Freshness

- 30-minute refresh cycle means data can be up to 30 minutes stale
- For real-time needs, consider a hybrid approach with fallback to live queries
- Admin can manually trigger refresh via POST `/api/v1/analytics/refresh`

### Scaling

- If property count grows significantly (50k+), consider partitioning by date
- Add more specific indexes based on actual query patterns
- Consider caching frequently-accessed analytics with Redis

### Location Hierarchy

- Current implementation groups by `propertyLocationId` directly
- For city-level aggregation across municipalities, you may need to resolve parent locations
- The service can be extended to support hierarchical location queries
