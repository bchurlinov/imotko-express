// COPIED FROM imotko/src/lib/chat/platform_chat.js (only: PLATFORM_KINDS, isPlatformKind) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ConversationKind } from "#generated/prisma/enums.ts"

export const PLATFORM_KINDS = Object.freeze([ConversationKind.PLATFORM_SUPPORT, ConversationKind.PLATFORM_TOPIC])

export const isPlatformKind = kind => PLATFORM_KINDS.includes(kind)
