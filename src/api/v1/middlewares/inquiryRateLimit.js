import rateLimit from "express-rate-limit"

/**
 * IP-based rate limiter for public inquiry submissions
 *
 * @type {import('express').RequestHandler}
 */
export const inquiryRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            data: undefined,
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
