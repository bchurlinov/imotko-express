// COPIED FROM imotko/src/lib/chat/message_policy.js (only: buildPrivateDedupeKey) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ConversationKind } from "#generated/prisma/enums.ts"

export const buildPrivateDedupeKey = ({ buyerUserId, sellerUserId, propertyId }) =>
    `${ConversationKind.PRIVATE_INQUIRY}:u:${buyerUserId}:s:${sellerUserId}:p:${propertyId}`
