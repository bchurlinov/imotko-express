// COPIED FROM imotko/src/lib/chat/listing_first_contact.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ConversationKind, MessageKind, MessageStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { ANALYTICS_EVENTS } from "../analytics/events.js"
import { buildListingMetaData, META_EVENTS, metaEventId } from "../analytics/meta_events.js"
import { captureMetaConversion } from "../analytics/meta_conversion.js"

// PropertyFirstContact: the first buyer message a private owner can see on a listing. Shared with imotko-express by
// scripts/export_property_rules.mjs. Call it after the transaction that delivered the message has committed, without
// awaiting; it never throws. Callers pass any delivered message id and this decides whether it is the first.
export const trackListingFirstContact = async (messageId, { db = prisma } = {}) => {
    if (!messageId) return false

    try {
        const message = await db.message.findUnique({
            where: { id: messageId },
            select: {
                id: true,
                senderUserId: true,
                status: true,
                kind: true,
                conversation: {
                    select: {
                        kind: true,
                        propertyId: true,
                        property: {
                            select: {
                                id: true,
                                clientId: true,
                                listingType: true,
                                type: true,
                                client: { select: { user: { select: { id: true, email: true } } } },
                            },
                        },
                    },
                },
            },
        })

        const property = message?.conversation?.property
        const seller = property?.client?.user
        if (
            !message ||
            message.status !== MessageStatus.DELIVERED ||
            message.kind !== MessageKind.USER ||
            message.conversation.kind !== ConversationKind.PRIVATE_INQUIRY ||
            !property?.clientId ||
            !seller?.id ||
            message.senderUserId === seller.id
        ) {
            return false
        }

        const earliest = await db.message.findFirst({
            where: {
                status: MessageStatus.DELIVERED,
                kind: MessageKind.USER,
                senderUserId: { not: seller.id },
                conversation: { kind: ConversationKind.PRIVATE_INQUIRY, propertyId: property.id },
            },
            orderBy: [{ deliveredAt: "asc" }, { id: "asc" }],
            select: { id: true },
        })
        if (earliest?.id !== messageId) return false

        captureMetaConversion({
            distinctId: seller.id,
            event: ANALYTICS_EVENTS.CLIENT_LISTING_FIRST_CONTACT,
            metaEventName: META_EVENTS.PROPERTY_FIRST_CONTACT,
            metaEventId: metaEventId.propertyFirstContact(property.id),
            actionSource: "system_generated",
            user: seller,
            customData: buildListingMetaData({ listingType: property.listingType, type: property.type }),
        })
        return true
    } catch (error) {
        console.error("[chat] first contact tracking failed", error)
        return false
    }
}
