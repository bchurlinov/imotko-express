import rateLimit from "express-rate-limit"
import { createRateLimitStore, sharedRateLimitOptions } from "#config/rateLimit.config.js"

/**
 * Listing reports per user (or IP before sign-in resolves): enough for a genuine user, too few to flood moderation.
 *
 * @type {import('express').RequestHandler}
 */
export const propertyReportRateLimit = rateLimit({
    ...sharedRateLimitOptions,
    windowMs: 60 * 60 * 1000,
    max: 20,
    store: createRateLimitStore("property-report"),
    keyGenerator: req => req.rateLimitKey?.key ?? `ip:${req.ip}`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            data: null,
            code: 429,
            message: "tooManyRequests",
        })
    },
    skip: req => {
        if (process.env.ENV === "development") {
            return true
        }

        return process.env.DISABLE_RATE_LIMIT === "true"
    },
})
