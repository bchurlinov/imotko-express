import { normalizeUrl } from "#utils/url/normalizeUrl.js"
import { getAllowedReferrers } from "#config/website.config.js"

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
    console.log("isAllowedReferrer - allowedReferrers:", allowedReferrers)

    // Return false if referer is malformed
    if (!normalizedReferer) return false

    // Check each allowed referrer
    for (const allowed of allowedReferrers) {
        // Add protocol if not present
        const allowedUrl = allowed.startsWith("http") ? allowed : `http://${allowed}`
        console.log("allowedUrl:", allowedUrl)
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
