import { chatResponse } from "./chat_response.js"
import {
    approveMessage,
    closeConversation,
    getAdminConversations,
    getConversationPendingMessages,
    getOpenReports,
    getPendingMessages,
    rejectMessage,
    resolveReport,
    setMessagingFlag,
} from "#services/chat/chat_admin.service.js"
import { getThread } from "#services/chat/chat_inbox.service.js"
import { CHAT_ERRORS } from "#services/chat/chat_constants.js"
import { ChatError } from "#services/chat/chat_error.js"
import { ALL_CAPABILITIES } from "#config/client_capabilities.js"

export const pendingMessagesController = async (req, res) =>
    chatResponse(res, 200, null, await getPendingMessages({ page: req.query.page }))
export const adminConversationsController = async (req, res) =>
    chatResponse(
        res,
        200,
        null,
        await getAdminConversations({
            page: req.query.page,
            agencyId: req.query.agencyId,
            email: req.query.email,
            from: req.query.from,
            to: req.query.to,
        })
    )
export const adminConversationController = async (req, res) => {
    const thread = await getThread(req.chatViewer, req.params.id, req.query.locale || "mk", ALL_CAPABILITIES)
    if (!thread) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
    return chatResponse(res, 200, null, {
        ...thread,
        pendingMessages: await getConversationPendingMessages(req.params.id),
    })
}
export const reportsController = async (req, res) =>
    chatResponse(res, 200, null, await getOpenReports({ page: req.query.page }))
export const approveMessageController = async (req, res) => {
    await approveMessage({ messageId: req.params.id, adminId: req.chatViewer.userId })
    return chatResponse(res, 200, "messageApproved")
}
export const rejectMessageController = async (req, res) => {
    await rejectMessage({ messageId: req.params.id, adminId: req.chatViewer.userId })
    return chatResponse(res, 200, "messageRejected")
}
export const closeConversationController = async (req, res) => {
    await closeConversation({ conversationId: req.params.id })
    return chatResponse(res, 200, "conversationClosed")
}
export const resolveReportController = async (req, res) => {
    await resolveReport({ reportId: req.params.id, adminId: req.chatViewer.userId })
    return chatResponse(res, 200, "reportResolved")
}
export const messagingFlagController = async (req, res) => {
    const user = await setMessagingFlag({
        userId: req.params.id,
        flagged: req.body.flagged,
        adminId: req.chatViewer.userId,
    })
    return chatResponse(res, 200, null, { messagingFlagged: user.messagingFlagged })
}
