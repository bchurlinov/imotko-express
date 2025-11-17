import { type NextFunction, type Request, type Response } from "express"
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"
import { getSupabaseJwksUrl, getSupabaseJwtSecret, getSupabaseUrl } from "@/config/supabase.js"
import createError from "http-errors"

const BEARER_PREFIX = "Bearer "
const normalizeBaseUrl = (url: string): string => url.replace(/\/$/, "")

const jwks = createRemoteJWKSet(new URL(getSupabaseJwksUrl()))
const hmacSecret = new TextEncoder().encode(getSupabaseJwtSecret())
const supabaseIssuer = `${normalizeBaseUrl(getSupabaseUrl())}/auth/v1`

interface SupabaseJwtPayload extends JWTPayload {
    sub: string
    email?: string
    role?: string
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const ensureRole = (payload: SupabaseJwtPayload): string | undefined => {
    if (typeof payload.role === "string") return payload.role

    if (isRecord(payload.app_metadata)) {
        const metadataRole = payload.app_metadata.role
        if (typeof metadataRole === "string") {
            return metadataRole
        }
    }

    return undefined
}

const verifyJwt = async (token: string) => {
    try {
        return await jwtVerify(token, jwks, { issuer: supabaseIssuer })
    } catch (error) {
        console.warn(
            "[Supabase] JWKS verification failed, attempting HS256 fallback:",
            error instanceof Error ? error.message : error,
        )

        return jwtVerify(token, hmacSecret, { issuer: supabaseIssuer })
    }
}

export const verifySupabaseToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

        const supabasePayload = payload as SupabaseJwtPayload

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
