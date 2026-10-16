import createError from "http-errors"
import chalk from "chalk"

// Local development only: lets a client ask for a fake failure so its error UI can be tested against the real error
// pipeline. The mobile Debug tab sends these headers; curl / Postman work too. Never active outside ENV=development.
export const FAULT_HEADER = "X-Imotko-Fault"
export const FAULT_MESSAGE_HEADER = "X-Imotko-Fault-Message"
export const FAULT_DELAY_HEADER = "X-Imotko-Fault-Delay"

const MAX_DELAY_MS = 30000

// Same shape validateRequest() produces from express-validator, so field-level error UI gets realistic input.
const SAMPLE_VALIDATION_ERRORS = [
    { type: "field", value: "", msg: "Invalid value", path: "email", location: "body" },
    { type: "field", value: -1, msg: "Invalid value", path: "price", location: "body" },
]

const VALIDATION_MESSAGE = "Проблем со валидирање на податоците."

/**
 * Two locks: the local development env and an explicit opt-in flag
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {boolean}
 */
export const isFaultInjectionEnabled = (env = process.env) =>
    env.ENV === "development" && env.NODE_ENV !== "production" && env.ENABLE_FAULT_INJECTION === "true"

/**
 * Header values are ASCII-only, so the client URI-encodes the message (Cyrillic etc.)
 * @param {string | undefined} value - Raw header value
 * @returns {string | null}
 */
const decodeMessage = value => {
    if (!value) return null
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

/**
 * @param {string | undefined} value - Raw header value
 * @returns {number} Delay in ms, clamped to 0..MAX_DELAY_MS
 */
const parseDelay = value => {
    const delay = Number(value)
    if (!Number.isFinite(delay) || delay <= 0) return 0
    return Math.min(delay, MAX_DELAY_MS)
}

/**
 * Applies one fault to the response
 * @param {string} fault - "400".."599", "timeout", "drop", "html" or "empty"
 * @param {string | null} message - Optional message override
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {boolean} false when the fault value is not recognised
 */
export const applyFault = (fault, message, req, res, next) => {
    // Never answer: the client gives up on its own timeout.
    if (fault === "timeout") return true
    // Kill the connection: the client sees a network error with no response.
    if (fault === "drop") {
        req.socket.destroy()
        return true
    }
    // What a proxy in front of the API returns when the app is down.
    if (fault === "html") {
        res.status(502).type("html").send("<html><body><h1>502 Bad Gateway</h1></body></html>")
        return true
    }
    if (fault === "empty") {
        res.status(500).end()
        return true
    }

    const status = Number(fault)
    if (!Number.isInteger(status) || status < 400 || status > 599) return false

    // Mirrors the production rate limiter body in app.js.
    if (status === 429) {
        res.status(429).json({ data: null, code: 429, message: message ?? "rateLimited" })
        return true
    }

    const isValidation = status === 400 || status === 422
    const errorMessage = message ?? (isValidation ? VALIDATION_MESSAGE : null)
    const props = isValidation ? { errors: SAMPLE_VALIDATION_ERRORS } : {}
    next(errorMessage ? createError(status, errorMessage, props) : createError(status, props))
    return true
}

/**
 * Builds the middleware; a plain pass-through unless fault injection is enabled
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {import('express').RequestHandler}
 */
export const createFaultInjection = (env = process.env) => {
    if (!isFaultInjectionEnabled(env)) return (req, res, next) => next()

    console.warn(chalk.yellow.bold(`[fault-injection] ENABLED: requests with ${FAULT_HEADER} will fail on purpose`))

    return async (req, res, next) => {
        const fault = String(req.get(FAULT_HEADER) ?? "")
            .trim()
            .toLowerCase()
        if (!fault) return next()

        try {
            const message = decodeMessage(req.get(FAULT_MESSAGE_HEADER))
            const delay = parseDelay(req.get(FAULT_DELAY_HEADER))
            console.warn(chalk.yellow(`[fault-injection] ${req.method} ${req.originalUrl} -> ${fault}`))

            if (delay) await new Promise(resolve => setTimeout(resolve, delay))
            if (req.destroyed) return

            if (!applyFault(fault, message, req, res, next)) {
                console.warn(chalk.yellow(`[fault-injection] unknown fault "${fault}", passing through`))
                next()
            }
        } catch (error) {
            next(error)
        }
    }
}
