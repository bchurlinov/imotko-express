import { createRemoteJWKSet, jwtVerify } from "jose"
import { getSupabaseJwksUrl, getSupabaseJwtSecret, getSupabaseUrl } from "../../../config/supabase.js"
import createError from "http-errors"

const BEARER_PREFIX = "Bearer "

/**
 * Normalize base URL by removing trailing slash
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
const normalizeBaseUrl = url => url.replace(/\/$/, "")

const jwks = createRemoteJWKSet(new URL(getSupabaseJwksUrl()))
const hmacSecret = new TextEncoder().encode(getSupabaseJwtSecret())
const supabaseIssuer = `${normalizeBaseUrl(getSupabaseUrl())}/auth/v1`

/**
 * Check if value is a record (plain object)
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a record
 */
const isRecord = value => typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Extract role from JWT payload
 * @param {object} payload - JWT payload
 * @returns {string | undefined} Role string or undefined
 */
const ensureRole = payload => {
    if (typeof payload.role === "string") return payload.role

    if (isRecord(payload.app_metadata)) {
        const metadataRole = payload.app_metadata.role
        if (typeof metadataRole === "string") {
            return metadataRole
        }
    }

    return undefined
}

/**
 * Verify JWT token using JWKS or HS256 fallback
 * @param {string} token - JWT token to verify
 * @returns {Promise<object>} Verification result
 */
const verifyJwt = async token => {
    try {
        return await jwtVerify(token, jwks, { issuer: supabaseIssuer })
    } catch (error) {
        console.warn(
            "[Supabase] JWKS verification failed, attempting HS256 fallback:",
            error instanceof Error ? error.message : error
        )

        return jwtVerify(token, hmacSecret, { issuer: supabaseIssuer })
    }
}

/**
 * Middleware to verify Supabase JWT token
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const verifySupabaseToken = async (req, res, next) => {
    try {
        const rawAuthHeader = Array.isArray(req.headers.authorization)
            ? req.headers.authorization[0]
            : req.headers.authorization

        if (!rawAuthHeader?.startsWith(BEARER_PREFIX)) {
            return next(createError(401, "Missing Supabase Bearer token"))
        }

        const token = rawAuthHeader.slice(BEARER_PREFIX.length).trim()

        if (!token) {
            return next(createError(401, "Missing Supabase Bearer token"))
        }

        const { payload } = await verifyJwt(token)

        const supabasePayload = payload

        if (typeof supabasePayload.sub !== "string" || supabasePayload.sub.length === 0) {
            return next(createError(401, "Invalid Supabase token payload"))
        }

        const role = ensureRole(supabasePayload)

        if (!role || role === "anon") {
            return next(createError(403, "Supabase role lacks required permissions"))
        }

        req.user = {
            id: supabasePayload.sub,
            email: supabasePayload.email,
            role,
            aud: supabasePayload.aud,
            exp: supabasePayload.exp,
            appMetadata: isRecord(supabasePayload.app_metadata) ? supabasePayload.app_metadata : undefined,
            userMetadata: isRecord(supabasePayload.user_metadata) ? supabasePayload.user_metadata : undefined,
        }

        next()
    } catch (error) {
        console.error("verifySupabaseToken error:", error)
        return next(createError(401, "Invalid or expired Supabase token"))
    }
}
