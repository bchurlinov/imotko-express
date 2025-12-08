import { Router } from "express"
import { query, param } from "express-validator"
import { validateRequest } from "#middlewares/validate_request.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"
import {
    getPriceTrendsController,
    getPricePerSqmController,
    getDemandAnalyticsController,
    getPropertyViewsController,
    refreshAnalyticsController,
} from "#controllers/analytics/analytics.controller.js"

const router = Router()

// Reusable validation rules
const rangeValidation = query("range")
    .optional()
    .isIn(["1m", "3m", "6m", "1y"])
    .withMessage("Range must be one of: 1m, 3m, 6m, 1y")

const listingTypeValidation = query("listingType")
    .optional()
    .isIn(["for_rent", "for_sale"])
    .withMessage("listingType must be for_rent or for_sale")

const propertyTypeValidation = query("propertyType")
    .optional()
    .isIn(["flat", "house", "land", "holiday_home", "garage", "commercial"])
    .withMessage("Invalid propertyType")

const groupByValidation = query("groupBy").optional().isIn(["city", "type"]).withMessage("groupBy must be city or type")

// GET /api/v1/analytics/price-trends
router.get(
    "/price-trends",
    [rangeValidation, listingTypeValidation, propertyTypeValidation, query("locationId").optional().isString().trim()],
    validateRequest,
    getPriceTrendsController
)

// GET /api/v1/analytics/price-per-sqm
router.get(
    "/price-per-sqm",
    [
        listingTypeValidation,
        propertyTypeValidation,
        groupByValidation,
        query("locationId").optional().isString().trim(),
    ],
    validateRequest,
    getPricePerSqmController
)

// GET /api/v1/analytics/demand (location-based demand analytics)
router.get(
    "/demand",
    [
        query("locationId").optional().isString().trim(),
        query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
    ],
    validateRequest,
    getDemandAnalyticsController
)

// GET /api/v1/analytics/demand/:id (views for specific property)
router.get(
    "/demand/:id",
    [param("id").notEmpty().withMessage("Property ID is required").trim(), rangeValidation],
    validateRequest,
    getPropertyViewsController
)

// POST /api/v1/analytics/refresh (admin only - requires authentication)
router.post("/refresh", verifySupabaseToken, refreshAnalyticsController)

export default router
