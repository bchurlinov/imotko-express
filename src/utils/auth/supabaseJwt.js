import { jwtVerify } from "jose"
import { getSupabaseJwtSecret, getSupabaseUrl } from "#supabase"

const BEARER_PREFIX = "Bearer "

/**
 * Normalize base URL by removing trailing slash
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
const normalizeBaseUrl = url => url.replace(/\/$/, "")

const hmacSecret = new TextEncoder().encode(getSupabaseJwtSecret())
const supabaseIssuer = `${normalizeBaseUrl(getSupabaseUrl())}/auth/v1`

/**
 * Extracts the raw bearer token from an Express request
 * @param {import('express').Request} req - Express request object
 * @returns {string | undefined} Token, or undefined when absent/malformed
 */
export const extractBearerToken = req => {
    const rawAuthHeader = Array.isArray(req.headers.authorization)
        ? req.headers.authorization[0]
        : req.headers.authorization

    if (!rawAuthHeader?.startsWith(BEARER_PREFIX)) return undefined

    const token = rawAuthHeader.slice(BEARER_PREFIX.length).trim()
    return token || undefined
}

/**
 * Verifies a Supabase JWT (HS256) and returns its payload
 * @param {string} token - JWT token to verify
 * @returns {Promise<import('jose').JWTPayload>} Verified payload
 * @throws When the signature, issuer or expiry is invalid
 */
export const verifySupabaseJwt = async token => {
    const { payload } = await jwtVerify(token, hmacSecret, { issuer: supabaseIssuer })
    return payload
}

/**
 * Verifies the request's bearer token and returns the Supabase user id.
 * Never throws — returns undefined for anonymous or invalid requests.
 * @param {import('express').Request} req - Express request object
 * @returns {Promise<string | undefined>} Verified `sub` claim, or undefined
 */
export const resolveVerifiedUserId = async req => {
    const token = extractBearerToken(req)
    if (!token) return undefined

    try {
        const payload = await verifySupabaseJwt(token)
        return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : undefined
    } catch {
        return undefined
    }
}
