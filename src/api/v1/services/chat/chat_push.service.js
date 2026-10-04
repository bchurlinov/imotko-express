import { MessageKind, MessageStatus, UserRole } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { inboxParticipantWhere } from "./chat_policy.js"
import { CHAT_ERRORS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"

export const EXPO_PUSH_TOKEN_PATTERN = /^(?:Expo|Exponent)PushToken\[[^\]\r\n]{1,512}\]$/

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
const PUSH_BATCH_SIZE = 100
const PUSH_PREVIEW_LENGTH = 120
const PUSH_REQUEST_WINDOW_MS = 5 * 60 * 1000

const preview = value => {
    const text = String(value || "")
        .replace(/\s+/g, " ")
        .trim()
    const characters = Array.from(text)
    return characters.length <= PUSH_PREVIEW_LENGTH ? text : `${characters.slice(0, PUSH_PREVIEW_LENGTH - 1).join("")}…`
}

const expoHeaders = () => ({
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
    ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
})

export const registerPushToken = async ({ userId, token, platform, locale }) =>
    prisma.userPushToken.upsert({
        where: { token },
        create: { userId, token, platform, locale, lastSeenAt: new Date() },
        update: { userId, platform, locale, lastSeenAt: new Date() },
    })

export const unregisterPushToken = async ({ userId, token }) => {
    await prisma.userPushToken.deleteMany({ where: { userId, token } })
}

const loadPush = async messageId => {
    const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
            id: true,
            conversationId: true,
            kind: true,
            status: true,
            bodyText: true,
            senderParticipantId: true,
            senderParticipant: { select: { displayName: true } },
            conversation: {
                select: {
                    participants: {
                        select: {
                            id: true,
                            userId: true,
                            user: { select: { role: true, pushTokens: { select: { id: true, token: true } } } },
                        },
                    },
                },
            },
        },
    })
    if (!message || message.kind !== MessageKind.USER || message.status !== MessageStatus.DELIVERED) return null

    const recipient = message.conversation.participants.find(item => item.id !== message.senderParticipantId)
    if (!recipient?.userId || recipient.user?.role !== UserRole.CLIENT || !recipient.user.pushTokens.length) return null

    const badge = await prisma.conversationParticipant.count({
        where: { ...inboxParticipantWhere({ type: "client", userId: recipient.userId }), unreadCount: { gt: 0 } },
    })

    return {
        conversationId: message.conversationId,
        title: message.senderParticipant.displayName || "Imotko",
        body: preview(message.bodyText) || "New message",
        badge,
        tokens: recipient.user.pushTokens,
    }
}

const sendBatch = async messages => {
    const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`)

    const payload = await response.json()
    if (payload?.errors?.length)
        throw new Error(`Expo push rejected the request: ${payload.errors[0]?.code || "unknown"}`)
    return Array.isArray(payload?.data) ? payload.data : []
}

export const sendChatPushNotification = async messageId => {
    const push = await loadPush(messageId)
    if (!push) return false

    const messages = push.tokens.map(token => ({
        tokenId: token.id,
        to: token.token,
        title: push.title,
        body: push.body,
        sound: "default",
        channelId: "chat",
        badge: push.badge,
        priority: "high",
        data: {
            type: "chat_message",
            conversationId: String(push.conversationId),
            url: `/conversation/${push.conversationId}`,
        },
    }))

    for (let start = 0; start < messages.length; start += PUSH_BATCH_SIZE) {
        const batch = messages.slice(start, start + PUSH_BATCH_SIZE)
        const tickets = await sendBatch(batch.map(({ tokenId, ...message }) => message))
        const successfulTickets = tickets.flatMap((ticket, index) =>
            ticket?.status === "ok" && typeof ticket.id === "string"
                ? [
                      {
                          tokenId: batch[index].tokenId,
                          messageId,
                          conversationId: push.conversationId,
                          ticketId: ticket.id,
                      },
                  ]
                : []
        )
        if (successfulTickets.length)
            await prisma.expoPushTicket.createMany({ data: successfulTickets, skipDuplicates: true })

        const invalidTokenIds = tickets.flatMap((ticket, index) =>
            ticket?.details?.error === "DeviceNotRegistered" ? [batch[index].tokenId] : []
        )
        if (invalidTokenIds.length) await prisma.userPushToken.deleteMany({ where: { id: { in: invalidTokenIds } } })
    }
    return true
}

// Push delivery must not delay or alter a committed chat message.
export const queueChatPushNotification = messageId => {
    if (!messageId) return
    void sendChatPushNotification(messageId).catch(error => {
        console.error("[chat-push] send failed", {
            messageId,
            error: error instanceof Error ? error.message : String(error),
        })
    })
}

// Next owns some chat writes. This lets it request the same push side effect without
// granting it access to recipient identities, device tokens, or the Expo credential.
export const requestMessagePush = async ({ messageId, viewer, now = new Date(), prismaClient = prisma, queuePush }) => {
    const message = await prismaClient.message.findUnique({
        where: { id: messageId },
        select: {
            id: true,
            kind: true,
            status: true,
            senderUserId: true,
            deliveredAt: true,
        },
    })
    if (!message || message.senderUserId !== viewer?.userId) throw new ChatError(CHAT_ERRORS.MESSAGE_NOT_FOUND, 404)

    const elapsedMs = message.deliveredAt
        ? now.getTime() - new Date(message.deliveredAt).getTime()
        : Number.POSITIVE_INFINITY
    const isFresh = elapsedMs >= 0 && elapsedMs <= PUSH_REQUEST_WINDOW_MS
    if (message.kind !== MessageKind.USER || message.status !== MessageStatus.DELIVERED || !isFresh) return false

    const alreadyPushed = await prismaClient.expoPushTicket.findFirst({ where: { messageId }, select: { id: true } })
    if (alreadyPushed) return false

    const enqueuePush = queuePush || queueChatPushNotification
    enqueuePush(messageId)
    return true
}
