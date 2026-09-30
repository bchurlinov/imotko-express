import { MessageKind, MessageStatus, UserRole } from "#generated/prisma/enums.ts"
import { CHAT_LIMITS, CHAT_SYSTEM_EVENTS, DAY_MS } from "./chat_constants.js"
import { canRemoveConversation } from "./chat_permissions.js"

export const buildDedupeKey = ({ kind, userId, agencyId, propertyId }) =>
    `${kind}:u:${userId}:a:${agencyId}:p:${propertyId || "none"}`

export const canStartAgencyInquiry = user => user?.role === UserRole.CLIENT

export const resolveInitialStatus = ({ senderType, emailVerified }) =>
    senderType === "agency" || emailVerified ? MessageStatus.DELIVERED : MessageStatus.PENDING_REVIEW

export const countUnanswered = (senderMessages, latestOtherAtByConversation) =>
    senderMessages.filter(({ conversationId, createdAt }) => {
        const otherAt = latestOtherAtByConversation.get(conversationId)
        return !otherAt || new Date(createdAt) > new Date(otherAt)
    }).length

export const reachedUnansweredLimit = count => count >= CHAT_LIMITS.UNANSWERED_PER_DAY

export const visibleMessageWhere = ({ viewerType, viewerUserId }) => {
    if (viewerType === "admin") return {}
    if (viewerType === "client") {
        return { OR: [{ status: MessageStatus.DELIVERED }, { senderUserId: viewerUserId }] }
    }
    return { status: MessageStatus.DELIVERED }
}

export const reminderDueWhere = now => ({
    unreadCount: { gt: 0 },
    conversation: { closedAt: null },
    OR: Array.from({ length: CHAT_LIMITS.REMINDERS_MAX }, (_, reminderCount) => ({
        reminderCount,
        firstUnreadAt: { lte: new Date(now.getTime() - (reminderCount + 1) * DAY_MS) },
    })),
})

export const userLanguageToLocale = language => {
    switch (String(language || "").toUpperCase()) {
        case "EN":
            return "en"
        case "SQ":
        case "AL":
            return "sq"
        case "TR":
            return "tr"
        default:
            return "mk"
    }
}

export const localeToUserLanguage = locale => ({ en: "EN", sq: "SQ", tr: "TR" })[locale] || "MK"

export const removalEventFor = viewerType =>
    viewerType === "client" ? CHAT_SYSTEM_EVENTS.CLIENT_REMOVED : CHAT_SYSTEM_EVENTS.AGENCY_REMOVED

export const notRemovedWhere = viewerType => ({
    messages: { none: { kind: MessageKind.SYSTEM, bodyText: removalEventFor(viewerType) } },
})

export { canRemoveConversation }
