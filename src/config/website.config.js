/**
 * Website configuration module
 * @module config/website
 */

/**
 * Gets the list of allowed referrer domains from environment variables
 * Reads ALLOWED_REFERRERS environment variable, splits by comma, and trims whitespace
 *
 * @returns {string[]} Array of allowed referrer domains (e.g., ['localhost:3000', 'example.com'])
 *                     Returns empty array if ALLOWED_REFERRERS is not configured
 *
 * @example
 * // In .env: ALLOWED_REFERRERS=localhost:3000,example.com,agency-site.com
 * getAllowedReferrers() // returns ['localhost:3000', 'example.com', 'agency-site.com']
 */
export function getAllowedReferrers() {
    const allowedReferrers = process.env.ALLOWED_REFERRERS
    console.log("allowedReferrers:", allowedReferrers)

    // Return empty array if not configured
    if (!allowedReferrers || allowedReferrers.trim() === "") {
        return []
    }

    // Split by comma, trim whitespace from each entry, and filter out empty strings
    return allowedReferrers
        .split(",")
        .map(referrer => referrer.trim())
        .filter(referrer => referrer.length > 0)
}
