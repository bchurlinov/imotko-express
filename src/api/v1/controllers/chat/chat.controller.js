import { chatResponse } from "./chat_response.js"
import {
    findAgencyInquiryId,
    markRead,
    reportConversation,
    sendMessage,
    startAgencyInquiry,
    toggleBlock,
} from "#services/chat/conversation.service.js"
import { removeConversation } from "#services/chat/chat_removal.service.js"
import { getChatContext, getInbox, getThread, getUnreadConversationCount } from "#services/chat/chat_inbox.service.js"
import { getPendingReviewCount } from "#services/chat/chat_admin.service.js"
import { requestMessagePush } from "#services/chat/chat_push.service.js"
import { CHAT_ERRORS, CHAT_LOCALES } from "#services/chat/chat_constants.js"
import { ChatError } from "#services/chat/chat_error.js"
import { isAccountCreationBlocked, recordAccountCreation } from "#services/chat/account_creation_limit.service.js"
import {
    createGuestClient,
    deleteGuestClient,
    existingGuestOutcome,
    normalizeGuestEmail,
    requestGuestMagicLink,
} from "#services/chat/chat_guest.service.js"
import { assertAgencyAvailable, startAgencyInquiry as startInquiry } from "#services/chat/conversation.service.js"
import { sanitizeMessage } from "#services/chat/chat_sanitizer.js"
import { getIpAddress } from "#utils/auth/ip_address.js"

const locale = value => (CHAT_LOCALES.includes(value) ? value : "mk")
const limited = value => Math.min(300, Math.max(1, Number.parseInt(value || "30", 10) || 30))

export const listConversationsController = async (req, res) =>
    chatResponse(
        res,
        200,
        null,
        await getInbox(req.chatViewer, {
            search: req.query.q || "",
            locale: locale(req.query.locale),
            limit: limited(req.query.limit),
        })
    )

export const lookupConversationController = async (req, res) => {
    if (req.chatViewer.type !== "client") return chatResponse(res, 200, null, { conversationId: null })
    const conversationId = await findAgencyInquiryId({
        userId: req.chatViewer.userId,
        agencyId: req.query.agencyId,
        propertyId: req.query.propertyId || null,
    })
    return chatResponse(res, 200, null, { conversationId })
}

export const startConversationController = async (req, res) => {
    if (req.chatViewer.type !== "client") throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
    const result = await startAgencyInquiry({
        userId: req.chatViewer.userId,
        agencyId: req.body.agencyId,
        propertyId: req.body.propertyId || null,
        bodyHtml: req.body.bodyHtml,
    })
    return chatResponse(res, 201, "messageSent", result)
}

export const getConversationController = async (req, res) => {
    const thread = await getThread(req.chatViewer, req.params.id, locale(req.query.locale))
    if (!thread) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
    return chatResponse(res, 200, null, thread)
}

export const sendMessageController = async (req, res) => {
    const message = await sendMessage({
        conversationId: req.params.id,
        viewer: req.chatViewer,
        bodyHtml: req.body.bodyHtml,
    })
    return chatResponse(res, 201, "messageSent", { messageId: message.id })
}

export const requestMessagePushController = async (req, res) => {
    const queued = await requestMessagePush({ messageId: req.params.messageId, viewer: req.chatViewer })
    return chatResponse(res, 202, queued ? "pushQueued" : "pushSkipped")
}

export const readConversationController = async (req, res) => {
    await markRead({ conversationId: req.params.id, viewer: req.chatViewer })
    return chatResponse(res, 200, null)
}

export const blockConversationController = async (req, res) => {
    const participant = await toggleBlock({ conversationId: req.params.id, viewer: req.chatViewer })
    return chatResponse(res, 200, null, { blocked: Boolean(participant.blockedAt) })
}

export const reportConversationController = async (req, res) => {
    await reportConversation({ conversationId: req.params.id, viewer: req.chatViewer, reason: req.body.reason })
    return chatResponse(res, 201, "reportSent")
}

export const removeConversationController = async (req, res) =>
    chatResponse(res, 200, null, await removeConversation({ conversationId: req.params.id, viewer: req.chatViewer }))

export const unreadController = async (req, res) => {
    const count =
        req.chatViewer.type === "admin"
            ? await getPendingReviewCount()
            : await getUnreadConversationCount(req.chatViewer)
    return chatResponse(res, 200, null, { count })
}

export const chatContextController = async (req, res) =>
    chatResponse(res, 200, null, await getChatContext(req.chatViewer))

export const guestController = async (req, res) => {
    const input = req.body
    if (typeof input.company === "string" && input.company.trim())
        return chatResponse(res, 200, "messageSent", { sent: true })
    const email = normalizeGuestEmail(input.email)
    const existing = await existingGuestOutcome({ email, verificationChoice: input.verificationChoice })
    if (existing) return chatResponse(res, 200, existing.message, existing.data)
    await assertAgencyAvailable({ agencyId: input.agencyId, propertyId: input.propertyId || null })
    const sanitized = sanitizeMessage(input.bodyHtml)
    if (sanitized.error) throw new ChatError(sanitized.error, 400)
    const ipAddress = getIpAddress(req)
    if (await isAccountCreationBlocked(ipAddress)) throw new ChatError(CHAT_ERRORS.ACCOUNT_CREATION_LIMITED, 429)

    let user
    try {
        user = await createGuestClient({
            email,
            name: input.name.trim(),
            phone: input.phone || null,
            locale: locale(input.locale),
            ipAddress,
        })
    } catch (error) {
        if (error instanceof ChatError && error.code === "accountExists") {
            const outcome = await existingGuestOutcome({ email, verificationChoice: input.verificationChoice })
            return chatResponse(res, 200, outcome.message, outcome.data)
        }
        throw error
    }
    if (input.verificationChoice === "verify") {
        try {
            await requestGuestMagicLink({ email, locale: locale(input.locale) })
        } catch (error) {
            await deleteGuestClient(user.id)
            throw error
        }
        await recordAccountCreation(ipAddress)
        return chatResponse(res, 201, "codeRequired", { codeRequired: true, accountCreated: true })
    }
    try {
        const result = await startInquiry({
            userId: user.id,
            agencyId: input.agencyId,
            propertyId: input.propertyId || null,
            bodyHtml: input.bodyHtml,
            requiresAdminReview: true,
        })
        await recordAccountCreation(ipAddress)
        return chatResponse(res, 201, "messageSent", {
            sent: true,
            accountCreated: true,
            conversationId: result.conversationId,
            pendingReview: true,
        })
    } catch (error) {
        await deleteGuestClient(user.id)
        throw error
    }
}
