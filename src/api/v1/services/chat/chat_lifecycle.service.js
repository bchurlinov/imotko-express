import { MessageKind, MessageStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { CHAT_SYSTEM_EVENTS } from "./chat_constants.js"
import { queueChatNewMessageEmail } from "./chat_email.service.js"
import { queueChatPushNotification } from "./chat_push.service.js"
import { notifyParticipant } from "./chat_notifications.service.js"
import { deliverMessage } from "./message_delivery.service.js"

export const releasePendingForUser = async userId => {
    if (!userId) return 0
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { messagingFlagged: true } })
    if (!user || user.messagingFlagged) return 0
    const pending = await prisma.message.findMany({
        where: { senderUserId: userId, status: MessageStatus.PENDING_REVIEW, requiresAdminReview: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    })
    let released = 0
    for (const message of pending) {
        const delivery = await prisma.$transaction(tx => deliverMessage(tx, message.id))
        if (delivery.delivered) released += 1
        queueChatNewMessageEmail(delivery.notifyParticipantId)
        queueChatPushNotification(delivery.pushMessageId)
    }
    return released
}

// Called inside the User deletion transaction before deleting the User row.
export const closeConversationsForDeletedUser = async (tx, userId, now = new Date()) => {
    const participants = await tx.conversationParticipant.findMany({
        where: { userId },
        select: {
            id: true,
            conversationId: true,
            displayName: true,
            conversation: { select: { closedAt: true, lastDeliveredAt: true, participants: true } },
        },
    })
    for (const participant of participants) {
        await tx.conversationParticipant.update({ where: { id: participant.id }, data: { deletedAt: now } })
        await tx.message.create({
            data: {
                conversationId: participant.conversationId,
                senderParticipantId: participant.id,
                senderUserId: null,
                kind: MessageKind.SYSTEM,
                bodyHtml: "",
                bodyText: CHAT_SYSTEM_EVENTS.ACCOUNT_DELETED,
                status: MessageStatus.DELIVERED,
                deliveredAt: now,
            },
        })
        if (!participant.conversation.closedAt) {
            await tx.conversation.update({ where: { id: participant.conversationId }, data: { closedAt: now } })
        }
        const counterpart = participant.conversation.participants.find(item => item.id !== participant.id)
        if (counterpart && participant.conversation.lastDeliveredAt) {
            await notifyParticipant(tx, {
                participant: counterpart,
                conversationId: participant.conversationId,
                type: "deleted",
                variables: { name: participant.displayName },
            })
        }
    }
    return participants.length
}
