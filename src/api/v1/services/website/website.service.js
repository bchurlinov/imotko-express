import prisma from "#database/client.js"
import { getAgencyService } from "#services/agencies/agencies.service.js"
import { normalizeUrl } from "#utils/url/normalizeUrl.js"
import { getAllowedReferrers } from "#config/website.config.js"
import {
    logAccessDenied,
    logOriginMismatch,
    logMalformedUrl,
    logMissingReferer,
    logAgencyNotFound,
    logDevBypass,
} from "#utils/logger/securityLogger.js"

/**
 * Allowed fields to return in agency response
 * These fields are safe to expose publicly via the website configuration API
 */
const ALLOWED_AGENCY_FIELDS = ["id", "name", "logo", "social", "description", "address"]

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
    // Normalize the referer URL to extract the domain
    const normalizedReferer = normalizeUrl(referer)
    if (!normalizedReferer) return null

    // Query all agencies with non-null social field, ordered by ID for deterministic results
    // Using Prisma select to fetch only allowed fields for performance and security
    // ORDER BY ensures consistent results if multiple agencies share the same domain
    const agencies = await prisma.agency.findMany({
        where: {
            social: {
                not: null,
            },
        },
        select: {
            id: true,
            name: true,
            logo: true,
            social: true,
            description: true,
            address: true,
        },
        orderBy: {
            id: "asc",
        },
    })

    // Find matching agency by comparing normalized domains
    let matchedAgency = null
    let matchCount = 0

    for (const agency of agencies) {
        // Check if social field has a website property
        if (agency.social && typeof agency.social === "object" && "website" in agency.social) {
            const website = agency.social.website

            // Skip if website is null or empty
            if (!website || website === "" || website.trim() === "") {
                continue
            }

            // Normalize the agency website URL
            const normalizedWebsite = normalizeUrl(website)

            // Skip and log if website URL is malformed
            if (!normalizedWebsite) {
                console.warn(`Agency ${agency.id} has malformed website URL: ${website}`)
                continue
            }

            // Compare normalized domains
            if (normalizedWebsite === normalizedReferer) {
                matchCount++

                // Store first match
                if (!matchedAgency) {
                    matchedAgency = agency
                }
            }
        }
    }

    // Log warning if multiple agencies match the same domain
    if (matchCount > 1) {
        console.warn(
            `Multiple agencies (${matchCount}) match domain: ${normalizedReferer}. Returning first match (ID: ${matchedAgency?.id}).`
        )
    }

    // Return filtered agency data or null
    return matchedAgency ? filterAgencyData(matchedAgency) : null
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
