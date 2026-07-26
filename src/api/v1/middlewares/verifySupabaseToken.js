import createError from "http-errors"
import { extractBearerToken, verifySupabaseJwt } from "#utils/auth/supabaseJwt.js"

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
        if (typeof metadataRole === "string") return metadataRole
    }

    return undefined
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
        const token = extractBearerToken(req)
        if (!token) return next(createError(401, "Недостасува или е невалиден токенот."))

        const supabasePayload = await verifySupabaseJwt(token)

        if (typeof supabasePayload.sub !== "string" || supabasePayload.sub.length === 0) {
            return next(createError(401, "Проблем при верификација на токенот."))
        }

        const role = ensureRole(supabasePayload)
        if (!role || role === "anon") return next(createError(403, "Supabase role lacks required permissions"))

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
        return next(createError(401, "Проблем при верификација на токенот."))
    }
}
