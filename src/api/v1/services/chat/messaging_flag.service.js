import { MessageKind, MessageStatus, MessagingFlagReason, UserRole } from "#generated/prisma/enums.ts"
import { DAY_MS } from "./chat_constants.js"
import { notifyUser } from "./chat_notifications.service.js"
import { countUnanswered, reachedUnansweredLimit } from "./chat_policy.js"

const messagesLinkForRole = role =>
    role === UserRole.CLIENT ? "/korisnicka-smetka/poraki" : "/smetka/agencija/prodazba/poraki"

export const countRecentUnanswered = async (db, userId, now = new Date(), unflaggedAt = null) => {
    const dayAgo = new Date(now.getTime() - DAY_MS)
    const since = unflaggedAt && unflaggedAt > dayAgo ? unflaggedAt : dayAgo
    const sent = await db.message.findMany({
        where: {
            senderUserId: userId,
            createdAt: { gte: since },
            status: { not: MessageStatus.REJECTED },
            kind: MessageKind.USER,
            // Decision 114a: a seller answering buyers about their own listings is not "unanswered" spam.
            senderParticipant: { isSeller: false },
        },
        select: { conversationId: true, senderParticipantId: true, createdAt: true },
    })
    if (!sent.length) return 0
    const replies = await db.message.groupBy({
        by: ["conversationId"],
        where: {
            conversationId: { in: [...new Set(sent.map(message => message.conversationId))] },
            senderParticipantId: { notIn: [...new Set(sent.map(message => message.senderParticipantId))] },
            status: MessageStatus.DELIVERED,
        },
        _max: { createdAt: true },
    })
    return countUnanswered(sent, new Map(replies.map(row => [row.conversationId, row._max.createdAt])))
}

export const flagUser = async (db, { userId, reason, flaggedById = null }) => {
    const user = await db.user.update({
        where: { id: userId },
        data: {
            messagingFlagged: true,
            messagingFlaggedAt: new Date(),
            messagingFlagReason: reason,
            messagingFlaggedById: flaggedById,
        },
    })
    await notifyUser(db, { userId, type: "restricted", link: messagesLinkForRole(user.role) })
    return user
}

export const unflagUser = async (db, { userId }) => {
    const user = await db.user.update({
        where: { id: userId },
        data: {
            messagingFlagged: false,
            messagingFlaggedAt: null,
            messagingFlagReason: null,
            messagingFlaggedById: null,
            messagingUnflaggedAt: new Date(),
        },
    })
    await notifyUser(db, { userId, type: "restored", link: messagesLinkForRole(user.role) })
    return user
}

export const enforceUnansweredLimit = async (db, user) => {
    if (user?.role !== UserRole.CLIENT) return false
    const count = await countRecentUnanswered(db, user.id, new Date(), user.messagingUnflaggedAt)
    if (!reachedUnansweredLimit(count)) return false
    await flagUser(db, { userId: user.id, reason: MessagingFlagReason.AUTO_THRESHOLD })
    return true
}
