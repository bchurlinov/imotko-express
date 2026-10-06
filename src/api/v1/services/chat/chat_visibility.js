import { ConversationKind } from "#generated/prisma/enums.ts"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { isPropertyVisibleTo } from "#services/properties/utils/visibility.js"

/**
 * A thread about a listing the caller cannot open (e.g. short-term rent before app 1.1.0) is returned without that
 * listing, so it shows as a plain agency conversation with every message intact.
 * @param {Object} conversation - Conversation row with property and/or propertySnapshot
 * @param {{ shortTermRent?: boolean }} [capabilities] - req.capabilities
 * @returns {Object}
 */
export const withoutHiddenProperty = (conversation, capabilities = LEGACY_CAPABILITIES) => {
    const listingType = conversation?.property?.listingType ?? conversation?.propertySnapshot?.listingType
    if (!listingType || isPropertyVisibleTo({ listingType }, capabilities)) return conversation
    return { ...conversation, propertyId: null, property: null, propertySnapshot: null }
}

/**
 * Conversation kinds a caller can open. Allow-list: apps before client listings know only agency inquiries, so
 * buyer–seller threads (B) and agency outreach (C) stay hidden from them.
 * @param {{ clientListings?: boolean }} [capabilities] - req.capabilities
 * @returns {string[]}
 */
export const visibleConversationKinds = (capabilities = LEGACY_CAPABILITIES) =>
    capabilities.clientListings ? Object.values(ConversationKind) : [ConversationKind.AGENCY_INQUIRY]

/**
 * @param {string} kind - Conversation.kind
 * @param {{ clientListings?: boolean }} [capabilities] - req.capabilities
 * @returns {boolean}
 */
export const isConversationKindVisible = (kind, capabilities = LEGACY_CAPABILITIES) =>
    visibleConversationKinds(capabilities).includes(kind)
