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
