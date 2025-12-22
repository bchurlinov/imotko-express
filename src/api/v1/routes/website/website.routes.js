/**
 * Website configuration routes module
 * @module routes/website
 */
import { Router } from "express"
import {
    agencyWebsiteConfigurationController,
    getWebsiteAgencyPropertiesController,
} from "#controllers/website/website.controller.js"
import { domainRateLimit } from "#middlewares/domainRateLimit.js"
import { attachAgencyFromReferer } from "#middlewares/agencyFromReferer.js"

const router = Router()

/**
 * GET /api/v1/website/configuration
 *
 * Retrieves agency website configuration based on the referer header.
 * Used by agency websites to fetch their configuration from the API.
 *
 * @name GetWebsiteConfiguration
 * @route {GET} /api/v1/website/configuration
 * @middleware {domainRateLimit} - 100 requests per 15 minutes per domain
 * @authentication None - Uses referer-based authorization
 *
 * @headerparam {string} referer - Required. The URL of the requesting website
 * @headerparam {string} [origin] - Optional. If present, must match referer domain
 *
 * @response {200} Success - Agency configuration data or allowed referrer confirmation
 * @response {403} Forbidden - Missing referer, malformed URL, or origin mismatch
 * @response {404} Not Found - No agency found matching the referer domain
 * @response {429} Too Many Requests - Rate limit exceeded
 *
 * @example
 * // Request from agency website
 * GET /api/v1/website/configuration
 * Headers:
 *   Referer: http://delta.mk
 *
 * // Success Response (200)
 * {
 *   "data": {
 *     "id": 1,
 *     "name": "Agency Name",
 *     "logo": "https://...",
 *     "social": { "website": "https://agency-website.com", ... },
 *     "description": "...",
 *     "address": "..."
 *   },
 *   "code": 200,
 *   "message": "Agency configuration loaded successfully"
 * }
 *
 * // Forbidden Response (403)
 * {
 *   "code": 403,
 *   "message": "forbiddenReferer"
 * }
 */
router.get("/configuration", domainRateLimit, agencyWebsiteConfigurationController)
router.get("/agency-properties", domainRateLimit, attachAgencyFromReferer, getWebsiteAgencyPropertiesController)

export default router
