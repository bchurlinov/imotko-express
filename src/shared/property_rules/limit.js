// COPIED FROM imotko/src/lib/client_listings/limit.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyListingType } from "#generated/prisma/enums.ts"
import {
    CLIENT_LISTING_COUNTED_STATUSES,
    CLIENT_LISTING_ERRORS,
    CLIENT_LISTING_LIMIT_PER_TYPE,
} from "./client_listings_constants.js"
import { ClientListingError } from "./client_listing_error.js"

export const countClientListings = (db, clientId, listingType, { excludePropertyId } = {}) =>
    db.property.count({
        where: {
            clientId,
            listingType,
            status: { in: [...CLIENT_LISTING_COUNTED_STATUSES] },
            ...(excludePropertyId ? { id: { not: excludePropertyId } } : {}),
        },
    })

// The advisory lock serializes every limit check of one client until the transaction ends, so two parallel creates
// cannot both see 4 and both insert.
export const assertBelowListingLimit = async (tx, clientId, listingType, { excludePropertyId } = {}) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clientId}))`
    const count = await countClientListings(tx, clientId, listingType, { excludePropertyId })
    if (count >= CLIENT_LISTING_LIMIT_PER_TYPE) throw new ClientListingError(CLIENT_LISTING_ERRORS.LIMIT_REACHED, 409)
}

export const getClientListingCounts = async (db, clientId) => {
    const rows = await db.property.groupBy({
        by: ["listingType"],
        where: { clientId, status: { in: [...CLIENT_LISTING_COUNTED_STATUSES] } },
        _count: { _all: true },
    })
    const counts = Object.fromEntries(Object.values(PropertyListingType).map(listingType => [listingType, 0]))
    rows.forEach(row => {
        counts[row.listingType] = row._count._all
    })
    return counts
}
