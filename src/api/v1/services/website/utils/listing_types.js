import { PropertyListingType } from "#generated/prisma/enums.ts"

/**
 * Listing types an agency website may show. Sales are always on; rentals follow the website settings.
 * A missing settings row behaves like the column defaults (long-term on, short-term off).
 * @param {{ enableRentals?: boolean | null, enableShortTermRentals?: boolean | null } | null | undefined} websiteSettings - AgencyWebsiteSettings
 * @returns {string[]}
 */
export const getAllowedListingTypes = websiteSettings => [
    PropertyListingType.for_sale,
    ...((websiteSettings?.enableRentals ?? true) ? [PropertyListingType.for_rent] : []),
    ...((websiteSettings?.enableShortTermRentals ?? false) ? [PropertyListingType.short_term_rent] : []),
]
