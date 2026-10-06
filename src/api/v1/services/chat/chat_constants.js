export const DAY_MS = 24 * 60 * 60 * 1000

export const CHAT_LIMITS = Object.freeze({
    UNANSWERED_PER_DAY: 10,
    UNVERIFIED_CONVERSATIONS: 2,
    NEW_CONVERSATIONS_PER_DAY: 10,
    MESSAGE_MAX_TEXT_LENGTH: 4000,
    MESSAGE_MAX_RAW_LENGTH: 50000,
    REMINDERS_MAX: 2,
    REPORT_REASON_MAX_LENGTH: 500,
})

export const CHAT_ERRORS = Object.freeze({
    UNAUTHORIZED: "unauthorized",
    FORBIDDEN: "forbidden",
    MESSAGING_RESTRICTED: "messagingRestricted",
    CONVERSATION_BLOCKED: "conversationBlocked",
    CONVERSATION_CLOSED: "conversationClosed",
    ACCOUNT_CREATION_LIMITED: "accountCreationLimited",
    USE_AGENCY_ACCOUNT: "useAgencyAccount",
    UNVERIFIED_CONVERSATION_LIMIT: "unverifiedConversationLimit",
    CONVERSATION_DAILY_LIMIT: "conversationDailyLimit",
    MESSAGE_EMPTY: "messageEmpty",
    MESSAGE_TOO_LONG: "messageTooLong",
    AGENCY_NOT_AVAILABLE: "agencyNotAvailable",
    NOT_FOUND: "conversationNotFound",
    MESSAGE_NOT_FOUND: "messageNotFound",
    MESSAGE_ALREADY_REVIEWED: "messageAlreadyReviewed",
    VALIDATION_FAILED: "validationFailed",
    SOMETHING_WENT_WRONG: "somethingWentWrong",
})

export const CHAT_SYSTEM_EVENTS = Object.freeze({
    ACCOUNT_DELETED: "accountDeleted",
    AGENCY_REMOVED: "agencyRemovedConversation",
    CLIENT_REMOVED: "clientRemovedConversation",
    SELLER_REMOVED: "sellerRemovedConversation",
    ACCOUNT_CONVERTED: "accountConverted",
})

export const CHAT_LOCALES = Object.freeze(["mk", "en", "sq", "tr"])
