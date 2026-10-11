import prisma from "#database/client.js"
import { normalizeUrl } from "#utils/url/normalizeUrl.js"
import { withCache } from "#utils/cache/index.js"
import { CACHE_TTL } from "#config/cache.config.js"

/**
 * Fields loaded for an agency website, shared by the referer lookup and the dev id lookup so both
 * resolve to the same shape.
 */
const AGENCY_WEBSITE_SELECT = {
    agencyMembers: {
        orderBy: {
            updatedAt: "desc",
        },
        include: {
            user: true,
        },
    },
    id: true,
    name: true,
    logo: true,
    social: true,
    description: true,
    address: true,
    location: true,
    email: true,
    phone: true,
    websiteSettings: true,
    testimonials: true,
    partners: {
        orderBy: {
            sortOrder: "asc",
        },
    },
}

/**
 * Retrieves an agency by matching the referer domain against agency website URLs
 *
 * @param {string} referer - The referer URL to match against
 * @returns {Promise<Object|null>} The matched agency object or null if not found
 *
 * @example
 * const agency = await getAgencyByReferer('https://example-agency.com/page');
 *
 * @note Performance Optimization:
 * For better performance with large datasets, consider adding a database index:
 * CREATE INDEX idx_agency_website ON "Agency" ((social->>'website'));
 *
 * This index would significantly speed up queries when matching referer domains.
 */
async function _getAgencyByReferer(referer) {
    const normalizedReferer = normalizeUrl(referer)
    if (!normalizedReferer) return null

    // First, find agencies with websites using raw query for the regex matching
    const matchingAgencies = await prisma.$queryRaw`
        SELECT id
        FROM "Agency"
        WHERE social IS NOT NULL
          AND social->>'website' IS NOT NULL
          AND social->>'website' != ''
          AND LOWER(
              REGEXP_REPLACE(
                  REGEXP_REPLACE(social->>'website', '^https?://(www\\.)?', ''),
                  '/.*$', ''
              )
          ) = LOWER(${normalizedReferer})
        ORDER BY id ASC
        LIMIT 1
    `

    if (!matchingAgencies.length) return null

    return prisma.agency.findUnique({
        where: { id: matchingAgencies[0].id },
        select: AGENCY_WEBSITE_SELECT,
    })
}

// Export cached version
export const getAgencyByReferer = withCache(_getAgencyByReferer, {
    keyPrefix: "getAgencyByReferer",
    ttl: CACHE_TTL.getAgencyByReferer, // 5 minutes
})

/**
 * Loads an agency straight by id, uncached. Local development only: lets an agency website running on
 * localhost pick any agency without editing `social.website`. Never call it from a production path.
 *
 * @param {string} id - Agency id
 * @returns {Promise<Object|null>} The agency or null if not found
 */
export async function getAgencyById(id) {
    if (!id) return null

    return prisma.agency.findUnique({
        where: { id },
        select: AGENCY_WEBSITE_SELECT,
    })
}
