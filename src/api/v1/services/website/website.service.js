import prisma from "#database/client.js"
import { normalizeUrl } from "#utils/url/normalizeUrl.js"
import { getAllowedReferrers } from "#config/website.config.js"
import {
    logAccessDenied,
    logAgencyNotFound,
    logDevBypass,
    logMalformedUrl,
    logMissingReferer,
    logOriginMismatch,
} from "#utils/logger/securityLogger.js"

/**
 * Allowed fields to return in agency response
 * These fields are safe to expose publicly via the website configuration API
 */
const ALLOWED_AGENCY_FIELDS = [
    "id",
    "name",
    "logo",
    "social",
    "description",
    "address",
    "location",
    "email",
    "phone",
    "websiteSettings",
    "testimonials",
]
/**
 * Standardized error response constants
 * Ensures consistent error messaging across the API
 */
const ErrorResponses = {
    FORBIDDEN_REFERER: { code: 403, message: "forbiddenReferer" },
    AGENCY_NOT_FOUND: { code: 404, message: "agencyNotFound" },
    INTERNAL_ERROR: { code: 500, message: "somethingWentWrong" },
}

/**
 * Filters agency data to only include allowed fields
 *
 * @param {Object} agency - The agency object to filter
 * @returns {Object} Filtered agency object with only allowed fields
 *
 * @example
 * const filtered = filterAgencyData(agency);
 */
export function filterAgencyData(agency) {
    if (!agency) return null

    const filtered = {}
    for (const field of ALLOWED_AGENCY_FIELDS) {
        if (field in agency) {
            filtered[field] = agency[field]
        }
    }
    return filtered
}

/**
 * Retrieves an agency by matching the referer domain against agency website URLs
 *
 * @param {string} referer - The referer URL to match against
 * @returns {Promise<Object|null>} The matched agency object or null if not found
 *
 * @example
 * const agency = await getAgencyByReferer('https://example-agency.com/page');
 *
 * @note Performance Optimization:
 * For better performance with large datasets, consider adding a database index:
 * CREATE INDEX idx_agency_website ON "Agency" ((social->>'website'));
 *
 * This index would significantly speed up queries when matching referer domains.
 */
export async function getAgencyByReferer(referer) {
    const normalizedReferer = normalizeUrl(referer)
    if (!normalizedReferer) return null

    // First, find agencies with websites using raw query for the regex matching
    const matchingAgencies = await prisma.$queryRaw`
        SELECT id
        FROM "Agency"
        WHERE social IS NOT NULL
          AND social->>'website' IS NOT NULL
          AND social->>'website' != ''
          AND LOWER(
              REGEXP_REPLACE(
                  REGEXP_REPLACE(social->>'website', '^https?://(www\.)?', ''),
                  '/.*$', ''
              )
          ) = LOWER(${normalizedReferer})
        ORDER BY id ASC
        LIMIT 1
    `

    if (!matchingAgencies.length) return null

    return prisma.agency.findUnique({
        where: { id: matchingAgencies[0].id },
        select: {
            id: true,
            name: true,
            logo: true,
            social: true,
            description: true,
            address: true,
            location: true,
            email: true,
            phone: true,
            websiteSettings: true,
            testimonials: true,
        },
    })
}

/**
 * Checks if a referer URL is in the allowed referrers list
 *
 * @param {string} referer - The referer URL to check
 * @returns {boolean} True if referer is in allowed list, false otherwise
 *
 * @example
 * const allowed = isAllowedReferrer('https://localhost:3000/page');
 */
export function isAllowedReferrer(referer) {
    const allowedReferrers = getAllowedReferrers()
    const normalizedReferer = normalizeUrl(referer)

    // Return false if referer is malformed
    if (!normalizedReferer) return false

    // Check each allowed referrer
    for (const allowed of allowedReferrers) {
        // Add protocol if not present
        const allowedUrl = allowed.startsWith("http") ? allowed : `http://${allowed}`
        const normalizedAllowed = normalizeUrl(allowedUrl)

        // Skip malformed allowed URLs
        if (!normalizedAllowed) {
            continue
        }

        // Compare normalized domains
        if (normalizedAllowed === normalizedReferer) {
            return true
        }
    }

    return false
}

/**
 * Validates that Origin and Referer headers match (if both present)
 *
 * @param {string|undefined} referer - The referer header value
 * @param {string|undefined} origin - The origin header value
 * @returns {boolean} True if valid (match or only one present), false if mismatch
 *
 * @example
 * validateOriginRefererMatch('https://example.com/page', 'https://example.com') // true
 * validateOriginRefererMatch('https://example.com/page', 'https://other.com') // false
 * validateOriginRefererMatch('https://example.com/page', undefined) // true
 */
export function validateOriginRefererMatch(referer, origin) {
    // If either header is missing, allow the request
    if (!origin || !referer) return true

    // Normalize both URLs
    const normalizedReferer = normalizeUrl(referer)
    const normalizedOrigin = normalizeUrl(origin)

    // If either URL is malformed, reject
    if (!normalizedReferer || !normalizedOrigin) return false

    // Compare normalized domains - must match
    return normalizedOrigin === normalizedReferer
}

/**
 * Checks if development bypass should be applied
 *
 * @param {string|undefined} userAgent - The user-agent header value
 * @returns {boolean} True if in development mode with Postman, false otherwise
 *
 * @example
 * isDevelopmentBypass('PostmanRuntime/7.28.4') // true in dev mode
 * isDevelopmentBypass('Mozilla/5.0...') // false
 */
export function isDevelopmentBypass(userAgent) {
    if (process.env.NODE_ENV !== "development") return false

    // Check if user-agent contains "postman" (case-insensitive)
    if (!userAgent) return false

    return userAgent.toLowerCase().includes("postman")
}

/**
 * Main service function to get agency website configuration with full authorization
 *
 * @param {string|undefined} referer - The referer header value
 * @param {string|undefined} origin - The origin header value
 * @param {string|undefined} userAgent - The user-agent header value
 * @param {string|undefined} ip - Client IP address for logging
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: number, message: string}}>}
 *
 * @example
 * const result = await getAgencyWebsiteConfiguration(referer, origin, userAgent, ip);
 * if (result.success) {
 *   console.log(result.data); // Agency data
 * } else {
 *   console.log(result.error); // { code: 403, message: 'forbiddenReferer' }
 * }
 */
export async function getAgencyWebsiteConfiguration(referer, origin, userAgent, ip) {
    try {
        // Step 1: Check if referer header exists
        if (!referer) {
            logMissingReferer({ ip, userAgent })
            return {
                success: false,
                error: ErrorResponses.FORBIDDEN_REFERER,
            }
        }

        // Step 2: Validate referer URL is well-formed
        const normalizedReferer = normalizeUrl(referer)
        if (!normalizedReferer) {
            logMalformedUrl({ url: referer, source: "referer" })
            logAccessDenied({ referer, origin, userAgent, ip, reason: "Malformed referer URL" })
            return {
                success: false,
                error: ErrorResponses.FORBIDDEN_REFERER,
            }
        }

        // Step 3: Validate Origin and Referer match (if both present)
        const originRefererMatch = validateOriginRefererMatch(referer, origin)
        if (!originRefererMatch) {
            logOriginMismatch({ referer, origin, ip })
            logAccessDenied({
                referer,
                origin,
                userAgent,
                ip,
                reason: "Origin and Referer headers do not match",
            })
            return {
                success: false,
                error: ErrorResponses.FORBIDDEN_REFERER,
            }
        }

        // Step 4: Check development bypass
        const devBypass = isDevelopmentBypass(userAgent)
        if (devBypass) {
            logDevBypass({ referer, userAgent })
        }

        // Step 5: Check against allowed referrers list
        const allowed = isAllowedReferrer(referer)
        if (allowed) {
            return {
                success: true,
                data: {
                    allowed: true,
                    message: "Allowed referrer",
                },
            }
        }

        // Step 6: Check against database agencies
        const agency = await getAgencyByReferer(referer)
        if (!agency) {
            // If development bypass is active, allow the request even without agency match
            if (devBypass) {
                return {
                    success: true,
                    data: {
                        allowed: true,
                        devBypass: true,
                        message: "Development bypass - no agency match required",
                    },
                }
            }

            logAgencyNotFound({ referer, ip })
            logAccessDenied({
                referer,
                origin,
                userAgent,
                ip,
                reason: "No agency found matching referer domain",
            })

            return {
                success: false,
                error: ErrorResponses.AGENCY_NOT_FOUND,
            }
        }

        // Step 7: Return successful result with agency data (already filtered)
        return {
            success: true,
            data: agency,
        }
    } catch (error) {
        console.error("Error in getAgencyWebsiteConfiguration:", error)
        return {
            success: false,
            error: ErrorResponses.INTERNAL_ERROR,
        }
    }
}
