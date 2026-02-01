/**
 * Website configuration routes module
 * @module routes/website
 */
import { Router } from "express"
import { body } from "express-validator"
import {
    agencyWebsiteConfigurationController,
    getWebsiteAgencyPropertiesController,
    postAgencyContactController,
} from "#controllers/website/website.controller.js"
import {
    getWebsitePartnersController,
    createWebsitePartnerController,
    updateWebsitePartnerController,
    deleteWebsitePartnerController,
    reorderWebsitePartnersController,
} from "#controllers/website/partners.controller.js"
import { domainRateLimit } from "#middlewares/domainRateLimit.js"
import { attachAgencyFromReferer } from "#middlewares/agencyFromReferer.js"
import { validateRequest } from "#middlewares/validate_request.js"
import { verifySupabaseToken } from "#middlewares/verifySupabaseToken.js"

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
// name: user.name || '',
//     email: user.email || '',
//     phone: user.phone || '',
//     subject: '',
//     message: ''

router.get("/configuration", domainRateLimit, attachAgencyFromReferer, agencyWebsiteConfigurationController)
router.get("/agency-properties", domainRateLimit, attachAgencyFromReferer, getWebsiteAgencyPropertiesController)
router.post(
    "/agency-contact",
    [
        body("name").trim().notEmpty().withMessage("Name is required"),
        body("email").optional().isEmail().withMessage("Invalid email format").normalizeEmail(),
        body("phone")
            .trim()
            .notEmpty()
            .withMessage("Phone is required")
            .matches(/^[\+]?[(]?[0-9]{1,4}[)]?[-\s]?[(]?[0-9]{1,4}[)]?[-\s]?[0-9]{1,9}$/)
            .withMessage("Invalid phone number format"),
        body("subject").optional().trim(),
        body("message").optional().trim(),
        body("property").optional().isObject().withMessage("Property must be an object"),
        body("property.id").optional().isString().withMessage("Property ID must be an integer"),
        body("property.slug").optional().isString().trim().withMessage("Property slug must be a string"),
        body("property.name").optional().isString().trim().withMessage("Property name must be a string"),
    ],
    domainRateLimit,
    validateRequest,
    attachAgencyFromReferer,
    postAgencyContactController
)

// Partner management routes
router.get("/partners", domainRateLimit, attachAgencyFromReferer, getWebsitePartnersController)

router.post(
    "/partners",
    [
        body("name").trim().notEmpty().withMessage("Partner name is required"),
        body("image").optional().isObject().withMessage("Image must be a JSON object"),
        body("url").optional().isURL().withMessage("Invalid URL format"),
        body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a non-negative integer"),
    ],
    domainRateLimit,
    validateRequest,
    attachAgencyFromReferer,
    verifySupabaseToken,
    createWebsitePartnerController
)

router.put(
    "/partners/:partnerId",
    [
        body("name").optional().trim().notEmpty().withMessage("Partner name cannot be empty"),
        body("image").optional().isObject().withMessage("Image must be a JSON object"),
        body("url").optional().isURL().withMessage("Invalid URL format"),
        body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a non-negative integer"),
    ],
    domainRateLimit,
    validateRequest,
    attachAgencyFromReferer,
    verifySupabaseToken,
    updateWebsitePartnerController
)

router.delete("/partners/:partnerId", domainRateLimit, attachAgencyFromReferer, verifySupabaseToken, deleteWebsitePartnerController)

router.patch(
    "/partners/reorder",
    [
        body("partners").isArray().withMessage("Partners must be an array"),
        body("partners.*.id").isString().withMessage("Partner ID must be a string"),
        body("partners.*.sortOrder").isInt({ min: 0 }).withMessage("Sort order must be a non-negative integer"),
    ],
    domainRateLimit,
    validateRequest,
    attachAgencyFromReferer,
    verifySupabaseToken,
    reorderWebsitePartnersController
)

export default router
