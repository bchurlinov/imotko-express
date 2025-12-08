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
 * @param {string} [params.locationId] - Property location ID filter
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

        let joinConditions = []
        const queryParams = [yoyStartDate]
        let paramIndex = 2

        if (locationId) {
            joinConditions.push(`mt."propertyLocationId" = $${paramIndex}`)
            queryParams.push(locationId)
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
                COALESCE(AVG(mt.avg_price)::INTEGER, 0) AS avg_price,
                COALESCE(AVG(mt.avg_price_per_sqm)::INTEGER, 0) AS avg_price_per_sqm
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
 * @param {string} [params.locationId] - Property location ID filter
 * @param {string} [params.listingType] - Listing type filter ('for_rent' or 'for_sale')
 * @param {string} [params.propertyType] - Property type filter ('flat', 'house', etc.)
 * @param {'city' | 'type'} [params.groupBy='city'] - Group results by 'city' or 'type'
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getPricePerSqmService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, groupBy = "city" } = params

        let whereConditions = []
        const queryParams = []
        let paramIndex = 1

        if (locationId) {
            whereConditions.push(`"propertyLocationId" = $${paramIndex}`)
            queryParams.push(locationId)
            paramIndex++
        }
        if (listingType) {
            whereConditions.push(`"listingType"::text = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        }
        if (propertyType) {
            whereConditions.push(`property_type::text = $${paramIndex}`)
            queryParams.push(propertyType)
            paramIndex++
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""
        const groupByField = groupBy === "type" ? "property_type" : '"propertyLocationId"'

        const results = await prisma.$queryRawUnsafe(
            `
            SELECT
                ${groupByField} AS group_key,
                SUM(listing_count::BIGINT) AS listing_count,
                AVG(avg_price)::INTEGER AS avg_price,
                AVG(avg_size)::INTEGER AS avg_size,
                AVG(avg_price_per_sqm)::INTEGER AS avg_price_per_sqm,
                MIN(min_price_per_sqm) AS min_price_per_sqm,
                MAX(max_price_per_sqm) AS max_price_per_sqm
            FROM mv_price_per_sqm
            ${whereClause}
            GROUP BY ${groupByField}
            ORDER BY avg_price_per_sqm DESC
        `,
            ...queryParams
        )

        // If grouped by location, fetch location names
        if (groupBy === "city" && results.length > 0) {
            const locationIds = results.map(r => r.group_key).filter(Boolean)
            const locations = await prisma.propertyLocation.findMany({
                where: { id: { in: locationIds } },
                select: { id: true, name: true },
            })
            const locationMap = new Map(locations.map(l => [l.id, l.name]))
            results.forEach(r => {
                r.location_name = locationMap.get(r.group_key) || "Unknown"
            })
        }

        return { success: true, data: results }
    } catch (error) {
        console.error("getPricePerSqmService error:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Get demand analytics (property views)
 * @param {Object} params - Query parameters
 * @param {string} [params.locationId] - Property location ID filter
 * @param {string} [params.listingType] - Listing type filter ('for_rent' or 'for_sale')
 * @param {string} [params.propertyType] - Property type filter ('flat', 'house', etc.)
 * @param {string} [params.categoryId] - Property category ID filter
 * @param {TimeRange} [params.range='1y'] - Time range for data
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export const getDemandAnalyticsService = async (params = {}) => {
    try {
        const { locationId, listingType, propertyType, categoryId, range = "1y" } = params
        const startDate = getStartDate(range)

        let joinConditions = []
        const queryParams = [startDate]
        let paramIndex = 2

        if (locationId) {
            joinConditions.push(`pv."propertyLocationId" = $${paramIndex}`)
            queryParams.push(locationId)
            paramIndex++
        }
        if (listingType) {
            joinConditions.push(`pv."listingType"::text = $${paramIndex}`)
            queryParams.push(listingType)
            paramIndex++
        }
        if (propertyType) {
            joinConditions.push(`pv.property_type::text = $${paramIndex}`)
            queryParams.push(propertyType)
            paramIndex++
        }
        if (categoryId) {
            joinConditions.push(`pv."categoryId" = $${paramIndex}`)
            queryParams.push(categoryId)
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
                COALESCE(SUM(pv.view_count), 0) AS view_count,
                COALESCE(SUM(pv.unique_properties_viewed), 0) AS unique_properties_viewed
            FROM month_series ms
            LEFT JOIN mv_property_views pv ON ms.month = pv.month${additionalJoinConditions}
            GROUP BY ms.month
            ORDER BY ms.month ASC
        `,
            ...queryParams
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
