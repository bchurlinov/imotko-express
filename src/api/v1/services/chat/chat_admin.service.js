import { MessageStatus, MessagingFlagReason } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { CHAT_ERRORS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"
import { queueChatNewMessageEmail } from "./chat_email.service.js"
import { queueChatPushNotification } from "./chat_push.service.js"
import { deliverMessage } from "./message_delivery.service.js"
import { flagUser, unflagUser } from "./messaging_flag.service.js"

const PAGE_SIZE = 20
const pageArgs = page => {
    const current = Math.max(1, Number.parseInt(page || "1", 10) || 1)
    return { current, skip: (current - 1) * PAGE_SIZE, take: PAGE_SIZE }
}

const paged = async ({ model, where, orderBy, select, page }) => {
    const { current, skip, take } = pageArgs(page)
    const [total, rows] = await Promise.all([
        prisma[model].count({ where }),
        prisma[model].findMany({ where, orderBy, skip, take, select }),
    ])
    return { rows, total, page: current, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

const conversationSummarySelect = {
    id: true,
    kind: true,
    propertySnapshot: true,
    participants: { select: { displayName: true, agencyId: true, user: { select: { email: true } } } },
}

export const getPendingReviewCount = () => prisma.message.count({ where: { status: MessageStatus.PENDING_REVIEW } })

export const getPendingMessages = ({ page } = {}) =>
    paged({
        model: "message",
        where: { status: MessageStatus.PENDING_REVIEW },
        orderBy: { createdAt: "asc" },
        page,
        select: {
            id: true,
            bodyText: true,
            createdAt: true,
            conversationId: true,
            senderUser: { select: { id: true, email: true, createdAt: true, messagingFlagged: true } },
            conversation: { select: conversationSummarySelect },
        },
    })

export const getConversationPendingMessages = conversationId =>
    prisma.message.findMany({
        where: { conversationId, status: MessageStatus.PENDING_REVIEW },
        orderBy: { createdAt: "asc" },
        select: { id: true, bodyText: true, createdAt: true, senderUserId: true },
    })

export const getAdminConversations = ({ page, agencyId, email, from, to } = {}) => {
    const createdAt = {
        ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    }
    const filters = [
        agencyId ? { participants: { some: { agencyId } } } : null,
        email ? { participants: { some: { user: { email: { contains: email, mode: "insensitive" } } } } } : null,
        Object.keys(createdAt).length ? { createdAt } : null,
    ].filter(Boolean)
    return paged({
        model: "conversation",
        where: filters.length ? { AND: filters } : {},
        orderBy: { updatedAt: "desc" },
        page,
        select: {
            ...conversationSummarySelect,
            createdAt: true,
            updatedAt: true,
            closedAt: true,
            _count: { select: { messages: true, reports: true } },
        },
    })
}

export const getOpenReports = ({ page } = {}) =>
    paged({
        model: "conversationReport",
        where: { resolvedAt: null },
        orderBy: { createdAt: "asc" },
        page,
        select: {
            id: true,
            reason: true,
            createdAt: true,
            conversationId: true,
            reporterParticipant: { select: { displayName: true } },
        },
    })

const assertMessageReviewable = async (tx, messageId) => {
    const exists = await tx.message.findUnique({ where: { id: messageId }, select: { id: true } })
    if (!exists) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
    throw new ChatError(CHAT_ERRORS.MESSAGE_ALREADY_REVIEWED, 409)
}

export const approveMessage = async ({ messageId, adminId }) => {
    const delivery = await prisma.$transaction(async tx => {
        const claimed = await tx.message.updateMany({
            where: { id: messageId, status: MessageStatus.PENDING_REVIEW, reviewedAt: null },
            data: { reviewedById: adminId, reviewedAt: new Date() },
        })
        if (!claimed.count) await assertMessageReviewable(tx, messageId)
        const result = await deliverMessage(tx, messageId)
        if (!result.delivered) throw new ChatError(CHAT_ERRORS.MESSAGE_ALREADY_REVIEWED, 409)
        return result
    })
    queueChatNewMessageEmail(delivery.notifyParticipantId)
    queueChatPushNotification(delivery.pushMessageId)
}

export const rejectMessage = async ({ messageId, adminId }) =>
    prisma.$transaction(async tx => {
        const rejected = await tx.message.updateMany({
            where: { id: messageId, status: MessageStatus.PENDING_REVIEW },
            data: { status: MessageStatus.REJECTED, reviewedById: adminId, reviewedAt: new Date() },
        })
        if (!rejected.count) await assertMessageReviewable(tx, messageId)
    })

export const closeConversation = async ({ conversationId }) => {
    const result = await prisma.conversation.updateMany({
        where: { id: conversationId, closedAt: null },
        data: { closedAt: new Date() },
    })
    if (result.count) return
    const exists = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } })
    if (!exists) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
}

export const resolveReport = async ({ reportId, adminId }) => {
    const result = await prisma.conversationReport.updateMany({
        where: { id: reportId, resolvedAt: null },
        data: { resolvedAt: new Date(), resolvedById: adminId },
    })
    if (result.count) return
    const exists = await prisma.conversationReport.findUnique({ where: { id: reportId }, select: { id: true } })
    if (!exists) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
}

export const setMessagingFlag = async ({ userId, flagged, adminId }) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, messagingFlagged: true } })
    if (!user) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
    if (user.messagingFlagged === flagged) return user
    return flagged
        ? flagUser(prisma, { userId, reason: MessagingFlagReason.ADMIN, flaggedById: adminId })
        : unflagUser(prisma, { userId })
}
