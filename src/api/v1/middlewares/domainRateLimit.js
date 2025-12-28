import rateLimit from "express-rate-limit"
import { normalizeUrl } from "#utils/url/normalizeUrl.js"

/**
 * Domain-based rate limiter for website configuration endpoint
 * Limits requests based on the normalized referer domain
 *
 * Configuration:
 * - 100 requests per 15 minutes per domain
 * - Uses normalized referer domain as the rate limit key
 * - Returns 429 status with standardized error response when limit exceeded
 * - Includes Retry-After header in response
 *
 * @type {import('express').RequestHandler}
 */
export const domainRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers

    /**
     * Custom key generator that uses the normalized referer domain
     * Falls back to IP address if referer is not present or malformed
     *
     * @param {import('express').Request} req - Express request object
     * @returns {string} The rate limit key (normalized domain or IP)
     */
    keyGenerator: req => {
        const referer = req.get("referer") || req.get("referrer")

        if (!referer) {
            // Fall back to IP address if no referer
            return `ip:${req.ip}`
        }

        // Normalize the referer URL to extract domain
        const normalizedDomain = normalizeUrl(referer)

        if (!normalizedDomain) {
            // Fall back to IP address if referer is malformed
            return `ip:${req.ip}`
        }

        // Use normalized domain as key
        return `domain:${normalizedDomain}`
    },

    /**
     * Custom handler for rate limit exceeded (429) responses
     * Returns standardized error response format
     *
     * @param {import('express').Request} req - Express request object
     * @param {import('express').Response} res - Express response object
     */
    handler: (req, res) => {
        res.status(429).json({
            data: undefined,
            code: 429,
            message: "tooManyRequests",
        })
    },

    /**
     * Skip rate limiting in development mode and when explicitly disabled
     * This prevents issues during development and testing
     */
    skip: req => {
        // Skip rate limiting in development mode
        if (process.env.ENV === "development") {
            return true
        }
        // Skip rate limiting if explicitly disabled via environment variable
        return process.env.DISABLE_RATE_LIMIT === "true"
    },
})
