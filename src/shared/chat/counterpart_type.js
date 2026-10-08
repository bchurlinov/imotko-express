// COPIED FROM imotko/src/data/chat/inbox.js (only: counterpartTypeFor) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ConversationKind } from "#generated/prisma/enums.ts"

export const counterpartTypeFor = (own, counterpart, kind = null) => {
    if (kind === ConversationKind.AGENCY_OUTREACH) return own?.agencyId ? "private_seller" : "agency_outreach"
    if (own?.agencyId) return "client"
    if (counterpart?.isSeller) return "seller"
    if (own?.isSeller) return "buyer"
    return "agency"
}
