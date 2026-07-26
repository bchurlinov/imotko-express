/**
 * CORS configuration module
 * @module config/cors
 */

/**
 * Parses a comma separated origin list into normalized origins (no trailing slash)
 * @param {string | undefined} value - Raw comma separated env value
 * @returns {string[]} Normalized origin list
 */
const parseOriginList = value =>
    (value || "")
        .split(",")
        .map(origin => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean)

/** Origins that are always allowed, regardless of environment */
const BASE_ORIGINS = ["https://imotko.mk", "https://www.imotko.mk"]

/** Origins allowed only outside production */
const DEVELOPMENT_ORIGINS = ["http://localhost:3000", "http://localhost:3500", "http://127.0.0.1:5500"]

const isProduction = () => process.env.ENV === "production" || process.env.NODE_ENV === "production"

/**
 * Builds the allowed origin set from the base list, env overrides and dev defaults
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {Set<string>} Allowed origins
 */
export function getAllowedOrigins(env = process.env) {
    return new Set([
        ...BASE_ORIGINS,
        ...parseOriginList(env.CORS_ALLOWED_ORIGINS),
        ...(isProduction() ? [] : DEVELOPMENT_ORIGINS),
    ])
}

/**
 * Suffixes that allow any subdomain, e.g. ".imotko.mk" allows https://agency.imotko.mk
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {string[]} Suffix list
 */
export function getAllowedOriginSuffixes(env = process.env) {
    return parseOriginList(env.CORS_ALLOWED_ORIGIN_SUFFIXES)
}

/**
 * Checks whether a request Origin header is whitelisted
 * @param {string} origin - Origin header value
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {boolean} True when allowed
 */
export function isOriginAllowed(origin, env = process.env) {
    const normalized = origin.replace(/\/+$/, "")
    if (getAllowedOrigins(env).has(normalized)) return true

    let hostname
    try {
        const url = new URL(normalized)
        if (url.protocol !== "https:") return false
        hostname = url.hostname
    } catch {
        return false
    }

    return getAllowedOriginSuffixes(env).some(suffix => hostname === suffix.slice(1) || hostname.endsWith(suffix))
}

/**
 * CORS options for the `cors` middleware. Credentials are enabled, so the
 * reflected origin must never be "*".
 * @type {import('cors').CorsOptions}
 */
export const corsOptions = {
    origin(origin, callback) {
        // No Origin header: same-origin, curl, server-to-server, health checks
        if (!origin) return callback(null, true)
        // Reject without throwing so blocked preflights return 204 without CORS
        // headers instead of a 500 from the error middleware
        callback(null, isOriginAllowed(origin))
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
}
