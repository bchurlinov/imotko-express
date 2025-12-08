import {
    getPriceTrendsService,
    getPricePerSqmService,
    getDemandAnalyticsService,
    getPropertyViewsService,
    refreshAnalyticsViewsService,
} from "#services/analytics/analytics.service.js"

/**
 * Get price trends with YoY comparison
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
export const getPriceTrendsController = async (req, res, next) => {
    try {
        const { locationId, listingType, propertyType, range } = req.query
        const result = await getPriceTrendsService({
            locationId,
            listingType,
            propertyType,
            range,
        })

        if (!result.success) return res.status(500).json({ error: result.error })

        res.json(result.data)
    } catch (error) {
        next(error)
    }
}

/**
 * Get price per square meter statistics
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
export const getPricePerSqmController = async (req, res, next) => {
    try {
        const { locationId, listingType, propertyType, groupBy } = req.query
        const result = await getPricePerSqmService({
            locationId,
            listingType,
            propertyType,
            groupBy,
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
 * Get demand analytics by location (property views aggregated by location hierarchy)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
export const getDemandAnalyticsController = async (req, res, next) => {
    try {
        const { locationId, limit } = req.query
        const result = await getDemandAnalyticsService({
            locationId,
            limit: limit ? parseInt(limit, 10) : undefined,
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
 * Get views for a specific property
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
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
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */
export const refreshAnalyticsController = async (req, res, next) => {
    try {
        const result = await refreshAnalyticsViewsService()

        if (!result.success) {
            return res.status(500).json({ error: result.error })
        }

        res.json({ message: "Analytics views refreshed successfully" })
    } catch (error) {
        next(error)
    }
}
