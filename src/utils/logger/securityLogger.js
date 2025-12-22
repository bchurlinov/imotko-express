/**
 * Security Event Logger
 *
 * Logs security-related events for audit trails and monitoring.
 * Uses structured logging format for easy parsing and analysis.
 * Does NOT log sensitive data (cookies, auth tokens, passwords).
 */

/**
 * Security event types
 */
export const SecurityEventTypes = {
    ACCESS_DENIED: "ACCESS_DENIED",
    ORIGIN_MISMATCH: "ORIGIN_MISMATCH",
    MALFORMED_URL: "MALFORMED_URL",
    MISSING_REFERER: "MISSING_REFERER",
    AGENCY_NOT_FOUND: "AGENCY_NOT_FOUND",
    DEV_BYPASS_ACTIVE: "DEV_BYPASS_ACTIVE",
}

/**
 * Logs a security event with structured data
 *
 * @param {string} eventType - Type of security event (use SecurityEventTypes)
 * @param {Object} details - Event details
 * @param {string} [details.referer] - Referer header value
 * @param {string} [details.origin] - Origin header value
 * @param {string} [details.userAgent] - User-Agent header value
 * @param {string} [details.ip] - Client IP address
 * @param {string} [details.reason] - Denial reason or additional context
 * @param {string} [details.timestamp] - Event timestamp (auto-generated if not provided)
 *
 * @example
 * logSecurityEvent(SecurityEventTypes.ACCESS_DENIED, {
 *   referer: 'https://unknown.com',
 *   origin: 'https://unknown.com',
 *   ip: '192.168.1.1',
 *   reason: 'Domain not in allowed list'
 * });
 */
export function logSecurityEvent(eventType, details = {}) {
    const timestamp = details.timestamp || new Date().toISOString()

    // Create structured log entry
    const logEntry = {
        type: "SECURITY_EVENT",
        eventType,
        timestamp,
        referer: details.referer || "N/A",
        origin: details.origin || "N/A",
        userAgent: details.userAgent || "N/A",
        ip: details.ip || "N/A",
        reason: details.reason || "N/A",
    }

    // Use console.warn for security events (visible but not errors)
    console.warn("[SECURITY]", JSON.stringify(logEntry, null, 2))
}

/**
 * Logs an access denied event
 *
 * @param {Object} details - Event details
 * @param {string} [details.referer] - Referer header value
 * @param {string} [details.origin] - Origin header value
 * @param {string} [details.userAgent] - User-Agent header value
 * @param {string} [details.ip] - Client IP address
 * @param {string} details.reason - Specific reason for denial
 */
export function logAccessDenied(details) {
    logSecurityEvent(SecurityEventTypes.ACCESS_DENIED, details)
}

/**
 * Logs an origin/referer mismatch event
 *
 * @param {Object} details - Event details
 * @param {string} details.referer - Referer header value
 * @param {string} details.origin - Origin header value
 * @param {string} [details.ip] - Client IP address
 */
export function logOriginMismatch(details) {
    logSecurityEvent(SecurityEventTypes.ORIGIN_MISMATCH, {
        ...details,
        reason: "Origin and Referer domains do not match",
    })
}

/**
 * Logs a malformed URL event
 *
 * @param {Object} details - Event details
 * @param {string} details.url - The malformed URL
 * @param {string} [details.source] - Source of the URL (e.g., 'referer', 'agency_website')
 */
export function logMalformedUrl(details) {
    logSecurityEvent(SecurityEventTypes.MALFORMED_URL, {
        reason: `Malformed URL in ${details.source || "request"}: ${details.url}`,
    })
}

/**
 * Logs a missing referer event
 *
 * @param {Object} details - Event details
 * @param {string} [details.ip] - Client IP address
 * @param {string} [details.userAgent] - User-Agent header value
 */
export function logMissingReferer(details) {
    logSecurityEvent(SecurityEventTypes.MISSING_REFERER, {
        ...details,
        reason: "Referer header is required but was not provided",
    })
}

/**
 * Logs an agency not found event (after passing initial checks)
 *
 * @param {Object} details - Event details
 * @param {string} details.referer - Referer header value
 * @param {string} [details.ip] - Client IP address
 */
export function logAgencyNotFound(details) {
    logSecurityEvent(SecurityEventTypes.AGENCY_NOT_FOUND, {
        ...details,
        reason: "No agency found matching referer domain",
    })
}

/**
 * Logs a development bypass activation (for monitoring)
 *
 * @param {Object} details - Event details
 * @param {string} details.referer - Referer header value
 * @param {string} details.userAgent - User-Agent header value
 */
export function logDevBypass(details) {
    logSecurityEvent(SecurityEventTypes.DEV_BYPASS_ACTIVE, {
        ...details,
        reason: "Development bypass enabled for Postman",
    })
}
