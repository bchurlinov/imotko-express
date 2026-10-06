import { PropertyListingType } from "#generated/prisma/enums.ts"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"

/**
 * Prisma conditions that hide listings a caller cannot handle. Every property gate (search, promoted, detail,
 * favorites, chat) goes through here, so a new kind of listing is hidden in one place.
 * @param {{ shortTermRent?: boolean, clientListings?: boolean }} [capabilities] - req.capabilities
 * @returns {import('#generated/prisma/client.ts').Prisma.PropertyWhereInput[]}
 */
export const hiddenPropertyConditions = (capabilities = LEGACY_CAPABILITIES) => [
    ...(capabilities.shortTermRent ? [] : [{ listingType: { not: PropertyListingType.short_term_rent } }]),
    // Private (client-owned) listings, sub-project B.
    ...(capabilities.clientListings ? [] : [{ clientId: null }]),
]

/**
 * Same rule for a single loaded row
 * @param {{ listingType?: string, clientId?: string | null } | null | undefined} property - Loaded property
 * @param {{ shortTermRent?: boolean, clientListings?: boolean }} [capabilities] - req.capabilities
 * @returns {boolean}
 */
export const isPropertyVisibleTo = (property, capabilities = LEGACY_CAPABILITIES) =>
    Boolean(property) &&
    (capabilities.shortTermRent || property.listingType !== PropertyListingType.short_term_rent) &&
    (capabilities.clientListings || !property.clientId)
