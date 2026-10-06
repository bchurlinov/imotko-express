import prisma from "#database/client.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { visibleConversationKinds } from "#services/chat/chat_visibility.js"

const CLIENT_LISTINGS_FEATURE = "client_listings"

/**
 * Drops notifications an older app cannot follow: B's own (tagged by the web) and chat notifications about
 * conversations of a kind the app cannot open. Filtered in JS: the list is not paginated, and Prisma's NOT on a
 * missing JSON path would also drop untagged rows.
 * @param {Array<{ metadata?: any }>} notifications - Rows from prisma.notification.findMany
 * @param {{ clientListings?: boolean }} [capabilities] - req.capabilities
 * @param {typeof prisma} [db] - Prisma client (specs pass a stub)
 * @returns {Promise<Array>}
 */
export const withoutHiddenNotifications = async (notifications, capabilities = LEGACY_CAPABILITIES, db = prisma) => {
    if (capabilities.clientListings) return notifications

    const untagged = notifications.filter(row => row.metadata?.feature !== CLIENT_LISTINGS_FEATURE)
    const conversationIds = [
        ...new Set(untagged.map(row => row.metadata?.conversationId).filter(id => typeof id === "string")),
    ]
    if (!conversationIds.length) return untagged

    const hidden = await db.conversation.findMany({
        where: { id: { in: conversationIds }, kind: { notIn: visibleConversationKinds(capabilities) } },
        select: { id: true },
    })
    const hiddenIds = new Set(hidden.map(row => row.id))
    return untagged.filter(row => !hiddenIds.has(row.metadata?.conversationId))
}
