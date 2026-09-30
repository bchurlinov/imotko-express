import { MessageStatus } from "#generated/prisma/enums.ts"
import { notifyParticipant } from "./chat_notifications.service.js"

// The status update is the delivery lock shared by Express and Next. Only the winner performs recipient effects.
export const deliverMessage = async (tx, messageId, now = new Date()) => {
    const claimed = await tx.message.updateMany({
        where: { id: messageId, status: MessageStatus.PENDING_REVIEW },
        data: { status: MessageStatus.DELIVERED, deliveredAt: now },
    })
    if (!claimed.count) return { delivered: false, notifyParticipantId: null, pushMessageId: null }

    const message = await tx.message.findUnique({
        where: { id: messageId },
        select: {
            conversationId: true,
            senderParticipantId: true,
            conversation: { select: { participants: true } },
        },
    })
    if (!message) return { delivered: false, notifyParticipantId: null, pushMessageId: null }

    await tx.conversation.update({ where: { id: message.conversationId }, data: { lastDeliveredAt: now } })
    await tx.conversationParticipant.update({
        where: { id: message.senderParticipantId },
        data: { unreadCount: 0, firstUnreadAt: null, reminderCount: 0, lastReadAt: now },
    })
    const recipient = message.conversation.participants.find(item => item.id !== message.senderParticipantId)
    if (!recipient) return { delivered: true, notifyParticipantId: null, pushMessageId: null }

    const firstUnread = await tx.conversationParticipant.updateMany({
        where: { id: recipient.id, unreadCount: 0 },
        data: { unreadCount: { increment: 1 }, firstUnreadAt: now },
    })
    if (!firstUnread.count) {
        await tx.conversationParticipant.update({
            where: { id: recipient.id },
            data: { unreadCount: { increment: 1 } },
        })
    } else {
        await notifyParticipant(tx, { participant: recipient, conversationId: message.conversationId })
    }
    return {
        delivered: true,
        notifyParticipantId: firstUnread.count ? recipient.id : null,
        pushMessageId: recipient.userId ? messageId : null,
    }
}
