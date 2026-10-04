import { MessageKind, MessageStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { CHAT_ERRORS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"
import { findViewerParticipant } from "./conversation.service.js"
import { canRemoveConversation, removalEventFor, removalParticipantData } from "./chat_policy.js"

const removerNotificationsWhere = (viewer, participant, participants, conversationId) => {
    const base = { metadata: { path: ["conversationId"], equals: conversationId } }
    if (viewer.type === "client") return { ...base, recipientId: participant.userId }
    const clientUserId = participants.find(item => item.id !== participant.id)?.userId
    return clientUserId ? { ...base, recipientId: { not: clientUserId } } : base
}

export const removeConversation = async ({ conversationId, viewer, now = new Date() }) => {
    if (!canRemoveConversation(viewer)) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
    const event = removalEventFor(viewer.type)
    return prisma.$transaction(async tx => {
        const locked = await tx.conversation.updateMany({ where: { id: conversationId }, data: { updatedAt: now } })
        if (!locked.count) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
        const conversation = await tx.conversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                dedupeKey: true,
                participants: true,
            },
        })
        const participant = conversation ? findViewerParticipant(conversation.participants, viewer) : null
        if (!participant) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
        if (participant.removed) return { removed: true }

        await tx.message.create({
            data: {
                conversationId,
                senderParticipantId: participant.id,
                senderUserId: viewer.userId,
                kind: MessageKind.SYSTEM,
                bodyHtml: "",
                bodyText: event,
                status: MessageStatus.DELIVERED,
                deliveredAt: now,
            },
        })
        await tx.conversationParticipant.update({
            where: { id: participant.id },
            data: removalParticipantData(participant, now),
        })
        await tx.message.updateMany({
            where: { conversationId, status: MessageStatus.PENDING_REVIEW },
            data: { status: MessageStatus.REJECTED, reviewedAt: now },
        })
        await tx.notification.deleteMany({
            where: removerNotificationsWhere(viewer, participant, conversation.participants, conversationId),
        })
        await tx.conversation.update({
            where: { id: conversationId },
            data: { dedupeKey: `${conversation.dedupeKey}:removed:${now.getTime()}` },
        })
        return { removed: true }
    })
}
