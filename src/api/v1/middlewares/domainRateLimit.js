import rateLimit from "express-rate-limit"
import { createRateLimitStore, sharedRateLimitOptions } from "#config/rateLimit.config.js"

/**
 * Per-IP rate limiter for public website endpoints
 * Limits requests based on the real client IP address
 *
 * Configuration:
 * - 200 requests per minute per IP
 * - Uses the client IP as the rate limit key (requires `trust proxy` set correctly)
 * - Returns 429 status with standardized error response when limit exceeded
 * - Includes Retry-After header in response
 *
 * @type {import('express').RequestHandler}
 */
export const domainRateLimit = rateLimit({
    ...sharedRateLimitOptions,
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per window per IP
    store: createRateLimitStore("domain"),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers

    /**
     * Key rate limiting on the real client IP so a single abusive visitor
     * only exhausts their own quota, not the whole site's.
     * Relies on `app.set("trust proxy", ...)` to resolve the true client IP.
     *
     * @param {import('express').Request} req - Express request object
     * @returns {string} The rate limit key (client IP)
     */
    keyGenerator: req => `ip:${req.ip}`,

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
        // if (process.env.ENV === "development") {
        //     return true
        // }
        // Skip rate limiting if explicitly disabled via environment variable
        return process.env.DISABLE_RATE_LIMIT === "true"
    },
})
