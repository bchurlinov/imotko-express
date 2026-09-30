import { supabaseAdmin } from "#utils/supabaseClient.js"
import { extractBearerToken } from "#utils/auth/supabaseJwt.js"
import { resolveChatIdentity } from "#services/chat/chat_identity.service.js"
import { CHAT_ERRORS } from "#services/chat/chat_constants.js"
import { ChatError } from "#services/chat/chat_error.js"

export const resolveChatViewer = async (req, res, next) => {
    try {
        const token = extractBearerToken(req)
        if (!token) throw new ChatError(CHAT_ERRORS.UNAUTHORIZED, 401)

        const { data, error } = await supabaseAdmin.auth.getUser(token)
        if (error || !data?.user) throw new ChatError(CHAT_ERRORS.UNAUTHORIZED, 401)

        const identity = await resolveChatIdentity(data.user)
        req.chatViewer = identity.viewer
        req.chatUser = identity.user
        req.supabaseUser = data.user
        next()
    } catch (error) {
        if (error instanceof ChatError) return next(error)
        console.error("[chat-auth] identity resolution failed", {
            error: error instanceof Error ? error.message : String(error),
        })
        return next(new ChatError(CHAT_ERRORS.UNAUTHORIZED, 401))
    }
}

export const requireChatParticipant = (req, res, next) => {
    if (req.chatViewer?.type === "client" || req.chatViewer?.type === "agency") return next()
    return next(new ChatError(CHAT_ERRORS.FORBIDDEN, 403))
}

export const requireChatAdmin = (req, res, next) => {
    if (req.chatViewer?.type === "admin") return next()
    return next(new ChatError(CHAT_ERRORS.FORBIDDEN, 403))
}
