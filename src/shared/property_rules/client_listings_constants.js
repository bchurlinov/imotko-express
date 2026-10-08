// COPIED FROM imotko/src/constants/client_listings.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyStatus } from "#generated/prisma/enums.ts"

// Private sellers who post more than this per listing type are pointed to "Стани агенција".
export const CLIENT_LISTING_LIMIT_PER_TYPE = 5

// DECLINED and DELETED listings do not count towards the limit.
export const CLIENT_LISTING_COUNTED_STATUSES = Object.freeze([
    PropertyStatus.PENDING,
    PropertyStatus.PUBLISHED,
    PropertyStatus.UNPUBLISHED,
])

// Express hides notifications carrying this tag from apps that do not support client listings (roadmap rule 2).
export const CLIENT_LISTING_FEATURE = "client_listings"

export const CLIENT_LISTING_ERRORS = Object.freeze({
    LIMIT_REACHED: "clientListingLimitReached",
    CONTACT_DETAILS: "contactDetailsNotAllowed",
    NOT_ENOUGH_CREDITS: "notEnoughCredits",
    INVALID_STATUS: "invalidListingStatus",
    CANNOT_MESSAGE_OWN: "cannotMessageOwnListing",
    AGENCY_REQUEST_PENDING: "agencyRequestPending",
    FORBIDDEN: "forbidden",
    NOT_FOUND: "propertyNotFound",
})
