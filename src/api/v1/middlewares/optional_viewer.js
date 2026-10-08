import { extractBearerToken, verifySupabaseJwt } from "#utils/auth/supabaseJwt.js"

// Property details stay public; a valid token only tells who is looking (design D §4.2). A missing or bad token is
// treated as anonymous, never as an error.
export const attachOptionalViewer = async (req, res, next) => {
    const token = extractBearerToken(req)
    if (!token) return next()
    try {
        const payload = await verifySupabaseJwt(token)
        if (typeof payload?.sub === "string" && payload.sub) req.viewerSupabaseUserId = payload.sub
    } catch {
        // anonymous
    }
    return next()
}
