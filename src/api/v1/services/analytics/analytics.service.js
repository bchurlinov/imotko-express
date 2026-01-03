import prisma from "#database/client.js"

/**
 * @typedef {'1m' | '3m' | '6m' | '1y'} TimeRange
 */

/**
 * @typedef {Object} PriceTrendItem
 * @property {string} month - Month timestamp
 * @property {number} avg_price - Average price for the month
 * @property {number} avg_price_per_sqm - Average price per square meter
 * @property {number} listing_count - Number of listings
 * @property {number | null} yoy_change_percent - Year-over-year change percentage
 * @property {string} trend - Trend indicator ('up', 'down', 'stable')
 */

/**
 * Get date filter based on time range
 * @param {TimeRange} range - Time range ('1m', '3m', '6m', '1y')
 * @returns {Date} Start date for the range
 */
const getStartDate = range => {
    const now = new Date()
    switch (range) {
        case "1m":
            return new Date(now.setMonth(now.getMonth() - 1))
        case "3m":
            return new Date(now.setMonth(now.getMonth() - 3))
        case "6m":
            return new Date(now.setMonth(now.getMonth() - 6))
        case "1y":
        default:
            return new Date(now.setFullYear(now.getFullYear() - 1))
    }
}

/**
 * Get price trends with YoY comparison
 * @param {Object} params - Query parameters
 * @param {string} [params.locationId] - Property location ID or name filter (e.g., 'skopje' or location CUID)
 * @param {string} [params.listingType] - Listing type filter ('for_rent' or 'for_sale')
 * @param {string} [params.propertyType] - Property type filter ('flat', 'house', etc.)
 * @param {TimeRange} [params.range='1y'] - Time range for data
 * @returns {Promise<{success: boolean, data?: PriceTrendItem[], error?: string}>}
 */
export const getPriceTrendsService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, range = "1y" } = params
        const startDate = getStartDate(range)

        // Get start date for YoY comparison (1 year before the range start)
        const yoyStartDate = new Date(startDate)
        yoyStartDate.setFullYear(yoyStartDate.getFullYear() - 1)

        // Resolve locationId if it's a name instead of an ID
        let resolvedLocationId = locationId
        if (locationId) {
            const location = await prisma.propertyLocation.findUnique({
                where: { name: locationId },
                select: { id: true },
            })
            if (location) {
                resolvedLocationId = location.id
            }
        }

        let joinConditions = []
        const queryParams = [yoyStartDate]
        let paramIndex = 2

        if (resolvedLocationId) {
            joinConditions.push(`mt."propertyLocationId" = $${paramIndex}`)
            queryParams.push(resolvedLocationId)
            paramIndex++
        }
        if (listingType) {
            joinConditions.push(`mt."listingType"::text = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        }
        if (propertyType) {
            joinConditions.push(`mt.property_type::text = $${paramIndex}`)
            queryParams.push(propertyType)
            paramIndex++
        }

        const additionalJoinConditions = joinConditions.length > 0 ? ` AND ${joinConditions.join(" AND ")}` : ""

        const results = await prisma.$queryRawUnsafe(
            `
            WITH month_series AS (
                SELECT DATE_TRUNC('month', generate_series(
                    $1::timestamp,
                    NOW(),
                    '1 month'::interval
                )) AS month
            )
            SELECT
                ms.month,
                COALESCE(SUM(mt.listing_count::BIGINT), 0) AS listing_count,
                COALESCE((SUM(mt.avg_price * mt.listing_count) / NULLIF(SUM(mt.listing_count), 0))::INTEGER, 0) AS avg_price,
                COALESCE((SUM(mt.avg_price_per_sqm * mt.listing_count) / NULLIF(SUM(mt.listing_count), 0))::INTEGER, 0) AS avg_price_per_sqm
            FROM month_series ms
            LEFT JOIN mv_market_trend_analysis mt ON ms.month = mt.month${additionalJoinConditions}
            GROUP BY ms.month
            ORDER BY ms.month ASC
        `,
            ...queryParams
        )

        // Calculate YoY change for each month
        const dataWithYoY = results
            .map((item, _, arr) => {
                const yearAgo = new Date(item.month)
                yearAgo.setFullYear(yearAgo.getFullYear() - 1)

                const yearAgoData = arr.find(d => new Date(d.month).getTime() === yearAgo.getTime())

                let yoy_change_percent = null
                if (yearAgoData && yearAgoData.avg_price > 0) {
                    yoy_change_percent = Math.round(
                        ((item.avg_price - yearAgoData.avg_price) / yearAgoData.avg_price) * 100
                    )
                }

                return {
                    ...item,
                    yoy_change_percent,
                    trend: yoy_change_percent > 0 ? "up" : yoy_change_percent < 0 ? "down" : "stable",
                }
            })
            .filter(item => new Date(item.month) >= startDate)

        return { success: true, data: dataWithYoY }
    } catch (error) {
        console.error("getPriceTrendsService error:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Get price per square meter statistics
 * @param {Object} params - Query parameters
 * @param {string} [params.locationId] - Property location ID or name filter (e.g., 'skopje' or location CUID)
 * @param {string} [params.listingType] - Listing type filter ('for_rent' or 'for_sale')
 * @param {string} [params.propertyType] - Property type filter ('flat', 'house', etc.)
 * @param {'city' | 'type'} [params.groupBy='city'] - Group results by 'city' or 'type'
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getPricePerSqmService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, groupBy = "city" } = params

        const whereConditions = []
        const queryParams = []

        // 1. Logic for dynamic filtering
        // Resolve locationId if it's a name instead of an ID
        let resolvedLocationId = locationId
        if (locationId) {
            // Try to find location by name first
            const location = await prisma.propertyLocation.findUnique({
                where: { name: locationId },
                select: { id: true },
            })

            // If found by name, use the ID; otherwise use the provided value as-is (might be an ID)
            if (location) {
                resolvedLocationId = location.id
            }

            whereConditions.push(`mv."propertyLocationId" = $${queryParams.length + 1}`)
            queryParams.push(resolvedLocationId)
        }
        if (listingType) {
            whereConditions.push(`mv."listingType"::text = $${queryParams.length + 1}`)
            queryParams.push(listingType)
        }
        if (propertyType) {
            whereConditions.push(`mv.property_type::text = $${queryParams.length + 1}`)
            queryParams.push(propertyType)
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

        // 2. Determine Grouping
        // Whitelisting prevents SQL injection here
        const isGroupByType = groupBy === "type"
        const groupByField = isGroupByType ? "mv.property_type" : 'mv."propertyLocationId"'
        const selectKey = isGroupByType ? "mv.property_type" : "pl.name" // Select name if grouping by city

        // 3. Optimized Query
        // - Uses Weighted Average for accuracy
        // - Joins location table directly
        // - Casts counts to INTEGER to avoid JSON BigInt crash
        const results = await prisma.$queryRawUnsafe(
            `
            SELECT
                ${groupByField} AS group_id,
                ${!isGroupByType ? "MAX(pl.name) as location_name," : ""} 
                SUM(mv.listing_count)::INTEGER AS listing_count,
                
                -- Weighted Averages Calculation
                (SUM(mv.avg_price * mv.listing_count) / NULLIF(SUM(mv.listing_count), 0))::INTEGER AS avg_price,
                (SUM(mv.avg_size * mv.listing_count) / NULLIF(SUM(mv.listing_count), 0))::INTEGER AS avg_size,
                (SUM(mv.avg_price_per_sqm * mv.listing_count) / NULLIF(SUM(mv.listing_count), 0))::INTEGER AS avg_price_per_sqm,
                
                MIN(mv.min_price)::INTEGER AS min_price,
                MAX(mv.max_price)::INTEGER AS max_price
            FROM mv_price_per_sqm mv
            LEFT JOIN "PropertyLocation" pl ON mv."propertyLocationId" = pl.id
            ${whereClause}
            GROUP BY ${groupByField}
            ORDER BY avg_price_per_sqm DESC
            `,
            ...queryParams
        )

        // If grouping by type, the 'group_key' is the type name itself.
        // If grouping by city, we already fetched location_name via JOIN.
        const formattedResults = results.map(r => ({
            ...r,
            group_key: isGroupByType ? r.group_id : r.location_name || "Unknown",
        }))

        return { success: true, data: formattedResults }
    } catch (error) {
        console.error("getPricePerSqmService error:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Get demand analytics by location (property views aggregated by location)
 * @param {Object} params - Query parameters
 * @param {string} [params.locationId] - Property location ID or name filter (e.g., 'skopje' or location CUID)
 * @param {string} [params.listingType] - Listing type filter ('for_rent' or 'for_sale')
 * @param {number} [params.limit=20] - Maximum number of locations to return
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getDemandAnalyticsService = async (params = {}) => {
    try {
        const { locationId, listingType, limit = 20 } = params

        // Resolve locationId if it's a name instead of an ID
        let resolvedLocationId = locationId
        if (locationId) {
            const location = await prisma.propertyLocation.findUnique({
                where: { name: locationId },
                select: { id: true },
            })
            if (location) {
                resolvedLocationId = location.id
            }
        }

        let whereConditions = []
        const queryParams = []
        let paramIndex = 1

        // Build WHERE clause based on filters
        if (resolvedLocationId) {
            whereConditions.push(`mv."propertyLocationId" = $${paramIndex}`)
            queryParams.push(resolvedLocationId)
            paramIndex++
        }
        if (listingType) {
            whereConditions.push(`mv."listingType"::text = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

        const results = await prisma.$queryRawUnsafe(
            `
            SELECT
                mv."propertyLocationId" AS location_id,
                pl.name AS location_name,
                pl."parentId" AS parent_location_id,
                mv."listingType"::text AS listing_type,
                mv.total_views::INTEGER AS total_views,
                mv.distinct_properties_viewed::INTEGER AS distinct_properties_viewed,
                mv.avg_views_per_property::DECIMAL(10,1) AS avg_views_per_property,
                mv.first_view_date,
                mv.last_view_date
            FROM mv_property_views_by_location mv
            LEFT JOIN "PropertyLocation" pl ON mv."propertyLocationId" = pl.id
            ${whereClause}
            ORDER BY mv.total_views DESC
            LIMIT $${paramIndex}
        `,
            ...queryParams,
            limit
        )

        return { success: true, data: results }
    } catch (error) {
        console.error("getDemandAnalyticsService error:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Get views for a specific property
 * @param {string} propertyId - Property ID
 * @param {TimeRange} [range='1y'] - Time range for data
 * @returns {Promise<{success: boolean, data?: {monthly: Object[], total_views: number}, error?: string}>}
 */
export const getPropertyViewsService = async (propertyId, range = "1y") => {
    try {
        const startDate = getStartDate(range)

        const results = await prisma.$queryRaw`
            WITH month_series AS (
                SELECT DATE_TRUNC('month', generate_series(
                    ${startDate}::timestamp,
                    NOW(),
                    '1 month'::interval
                )) AS month
            )
            SELECT
                ms.month,
                COALESCE(pv.view_count, 0) AS view_count
            FROM month_series ms
            LEFT JOIN mv_property_views_per_listing pv
                ON ms.month = pv.month
                AND pv."propertyId" = ${propertyId}
            ORDER BY ms.month ASC
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
                total_views: Number(total[0]?.total_views || 0),
            },
        }
    } catch (error) {
        console.error("getPropertyViewsService error:", error)
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
        console.error("refreshAnalyticsViewsService error:", error)
        return { success: false, error: error.message }
    }
}
