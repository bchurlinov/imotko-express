import rateLimit from "express-rate-limit"
import { sharedRateLimitOptions } from "#config/rateLimit.config.js"

// Authenticated requests are bucketed per Supabase user id, so mobile clients
// sharing a carrier NAT address do not exhaust each other's budget. Anonymous
// traffic still falls back to a (IPv6 /64 normalized) IP bucket.
export const AUTHENTICATED_REQUEST_LIMIT = 500
export const ANONYMOUS_REQUEST_LIMIT = 100
const WINDOW_MS = 15 * 60 * 1000

/**
 * The global limiter is off unless RATE_LIMIT_ENABLED is exactly "true".
 * Deliberately not tied to ENV: ENV was never set in production, and the switch must be an explicit decision
 * made only after imotko and imotko-templates send INTERNAL_API_SECRET.
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {boolean} True when the global limiter should run
 */
export const isGlobalRateLimitEnabled = (env = process.env) => env.RATE_LIMIT_ENABLED === "true"

/**
 * Global limiter for every API route. Runs after attachRateLimitKey, which resolves `req.rateLimitKey`
 * and `req.trustedInternalCaller`; our own servers (web, templates) are skipped.
 *
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env] - Environment to read from
 * @param {() => import('express-rate-limit').Store | undefined} [options.createStore] - Called only when enabled,
 *   so a disabled limiter never opens a Redis store. Undefined keeps the in-memory store.
 * @param {number} [options.anonymousLimit] - Requests per window for an IP bucket
 * @param {number} [options.authenticatedLimit] - Requests per window for a user bucket
 * @returns {import('express').RequestHandler} Limiter, or a pass-through when disabled
 */
export const createGlobalRateLimiter = ({
    env = process.env,
    createStore = () => undefined,
    anonymousLimit = ANONYMOUS_REQUEST_LIMIT,
    authenticatedLimit = AUTHENTICATED_REQUEST_LIMIT,
} = {}) => {
    if (!isGlobalRateLimitEnabled(env)) return (req, res, next) => next()

    return rateLimit({
        ...sharedRateLimitOptions,
        windowMs: WINDOW_MS,
        limit: req => (req.rateLimitKey?.kind === "user" ? authenticatedLimit : anonymousLimit),
        keyGenerator: req => req.rateLimitKey?.key ?? `ip:${req.ip}`,
        skip: req => req.trustedInternalCaller === true,
        store: createStore(),
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: {
            data: null,
            code: 429,
            message: "rateLimited",
        },
    })
}
