import { PropertyCountry, PropertyStatus } from "#generated/prisma/enums.ts"
import {
    stringValue,
    stringValues,
    booleanValue,
    numberValue,
    positiveInt,
    buildNumericFilter,
    buildPriceFilter,
    buildAttributeFilter,
    buildPropertyFeaturesFilter,
    isPropertySort,
    resolveLocationIds,
    resolveCityLocationIds,
    ORDER_BY_MAP,
    DEFAULT_ORDER_BY,
    PAGE_SIZE,
    DEFAULT_LOCALE,
    FEATURED_PER_PAGE,
    featuredIdsForPage,
    activeFeaturedCondition,
    inactiveFeaturedCondition,
} from "./utils/index.js"
import prisma from "#database/client.js"
import { HIDDEN_AGENCY_IDS, isHiddenAgency } from "#config/hiddenAgencies.config.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { hiddenPropertyConditions, isPropertyVisibleTo } from "./utils/visibility.js"
import { firstNameOf } from "#shared/property_rules/seller_name.js"

/**
 * @typedef {import('#types/api.js').ApiResponse} ApiResponse
 * @typedef {import('#generated/prisma/client.ts').Prisma.PropertyGetPayload<{include: {agency: true}}>} PropertyWithRelations
 * @typedef {import('#generated/prisma/client.ts').Prisma.PropertyWhereInput} PropertyWhereInput
 * @typedef {import('#generated/prisma/client.ts').Prisma.PropertyOrderByWithRelationInput} PropertyOrderByWithRelationInput
 * @typedef {import('#generated/prisma/client.ts').Prisma.PropertySelect} PropertySelect
 * @typedef {string | number | boolean | string[] | undefined} PrimitiveParam
 */

/**
 * @typedef {Object} PropertyQueryParams
 * @property {PrimitiveParam} [in_development]
 * @property {PrimitiveParam} [location]
 * @property {PrimitiveParam} [district]
 * @property {PrimitiveParam} [subCategory]
 * @property {PrimitiveParam} [category]
 * @property {PrimitiveParam} [listingType]
 * @property {PrimitiveParam} [guests]
 * @property {PrimitiveParam} [size]
 * @property {PrimitiveParam} [size_from]
 * @property {PrimitiveParam} [size_to]
 * @property {PrimitiveParam} [with_price]
 * @property {PrimitiveParam} [price_from]
 * @property {PrimitiveParam} [price_to]
 * @property {PrimitiveParam} [numOfBedroomsFrom]
 * @property {PrimitiveParam} [numOfBedroomsTo]
 * @property {PrimitiveParam} [numOfBathroomsFrom]
 * @property {PrimitiveParam} [numOfBathroomsTo]
 * @property {PrimitiveParam} [propertyFeatures]
 * @property {PrimitiveParam} [north]
 * @property {PrimitiveParam} [south]
 * @property {PrimitiveParam} [east]
 * @property {PrimitiveParam} [west]
 * @property {PrimitiveParam} [sortBy]
 * @property {PrimitiveParam} [query]
 * @property {PrimitiveParam} [limit]
 * @property {PrimitiveParam} [page]
 * @property {PrimitiveParam} [locale]
 * @property {PrimitiveParam} [ids]
 * @property {PrimitiveParam} [agency]
 * @property {PrimitiveParam} [country]
 * @property {PrimitiveParam} [featured]
 * @property {PrimitiveParam} [includePending]
 * @property {PrimitiveParam} [showMap]
 */

/**
 * Get properties with filtering, sorting, and pagination
 * @param {PropertyQueryParams} params - Query parameters
 * @param {Object} [options] - Internal options (never derived from query params)
 * @param {boolean} [options.includeHiddenAgencies] - Bypass the hidden agency exclusion
 * @param {boolean} [options.promoteFeatured] - Mix promoted properties into paginated results
 * @param {{ shortTermRent?: boolean }} [options.capabilities] - req.capabilities (defaults to legacy)
 * @returns {Promise<ApiResponse<PropertyWithRelations[]>>}
 */
export const getPropertiesService = async (params = {}, options = {}) => {
    try {
        const { includeHiddenAgencies = false, promoteFeatured = true, capabilities = LEGACY_CAPABILITIES } = options
        const locale = stringValue(params.locale) ?? DEFAULT_LOCALE

        const includePending = booleanValue(params.includePending) && params.agency
        const featuredOnly = booleanValue(params.featured) === true
        const country = normalizeCountry(params.country)
        const now = new Date()
        let filters = {
            status: includePending
                ? { in: [PropertyStatus.PUBLISHED, PropertyStatus.PENDING] }
                : PropertyStatus.PUBLISHED,
        }

        const andConditions = []
        const orGroups = []

        if (featuredOnly) andConditions.push(activeFeaturedCondition(now))
        if (country) filters.country = country
        const ids = stringValues(params.ids)
        if (ids.length) filters.id = { in: ids }
        if (params.agency) filters.agencyId = stringValue(params.agency)

        // Hidden agencies are never exposed through the public API. agencyId is nullable,
        // so the null branch keeps properties without an agency in the result set.
        if (!includeHiddenAgencies && HIDDEN_AGENCY_IDS.length) {
            andConditions.push({
                OR: [{ agencyId: null }, { agencyId: { notIn: HIDDEN_AGENCY_IDS } }],
            })
        }

        // Listings this caller cannot handle (e.g. short-term rent for apps before 1.1.0) are never returned.
        andConditions.push(...hiddenPropertyConditions(capabilities))

        const inDevelopment = booleanValue(params.in_development)
        if (typeof inDevelopment === "boolean") filters.inDevelopment = inDevelopment

        let promotedLocationIds = []
        const location = stringValue(params.location)
        if (location) {
            const [locationIds, cityLocationIds] = await Promise.all([
                resolveLocationIds(location),
                promoteFeatured && !featuredOnly ? resolveCityLocationIds(location) : [],
            ])
            promotedLocationIds = cityLocationIds

            if (locationIds.length) {
                filters.propertyLocationId = { in: locationIds }
            } else {
                filters.propertyLocationId = location
            }
        }

        if (params.subCategory) filters.subcategoryId = stringValue(params.subCategory)
        if (params.category) filters.categoryId = stringValue(params.category)

        const district = stringValue(params.district)
        if (district) filters.district = district

        const listingType = stringValue(params.listingType)
        if (listingType) filters.listingType = listingType

        const guests = positiveInt(params.guests)
        if (guests) filters.maxGuests = { gte: guests }

        const sizeFilter =
            buildNumericFilter(params.size_from ?? params.size, params.size_to) ??
            buildNumericFilter(params.size, undefined)
        if (sizeFilter) filters.size = sizeFilter

        const withPriceOnly = booleanValue(params.with_price) ?? false
        const priceRangeProvided = params.price_from !== undefined || params.price_to !== undefined

        if (withPriceOnly) {
            filters.price = buildPriceFilter(params.price_from, params.price_to, true)
        } else if (priceRangeProvided) {
            const priceFilter = buildPriceFilter(params.price_from, params.price_to, true)
            if (priceFilter) orGroups.push([{ price: { equals: 0 } }, { price: priceFilter }])
        }

        const bedroomFilter = buildAttributeFilter("numOfRooms", params.numOfBedroomsFrom, params.numOfBedroomsTo)
        if (bedroomFilter) andConditions.push(bedroomFilter)

        const bathroomFilter = buildAttributeFilter(
            "numOfBathrooms",
            params.numOfBathroomsFrom,
            params.numOfBathroomsTo
        )
        if (bathroomFilter) andConditions.push(bathroomFilter)

        if (params.propertyFeatures) {
            const featureConditions = buildPropertyFeaturesFilter(params.propertyFeatures)
            if (featureConditions.length > 0) andConditions.push(...featureConditions)
        }

        // Geographic bounding box filtering
        const north = numberValue(params.north)
        const south = numberValue(params.south)
        const east = numberValue(params.east)
        const west = numberValue(params.west)

        if (south !== undefined && north !== undefined && west !== undefined && east !== undefined) {
            filters.latitude = {
                gte: south,
                lte: north,
            }
            filters.longitude = {
                gte: west,
                lte: east,
            }
        }

        const sortParam = stringValue(params.sortBy)
        const shouldShuffleFeatured = featuredOnly && !sortParam
        const orderBy = sortParam && isPropertySort(sortParam) ? ORDER_BY_MAP[sortParam] : DEFAULT_ORDER_BY

        const searchQuery = stringValue(params.query)
        if (searchQuery) {
            const searchConditions = [
                {
                    name: {
                        path: [locale],
                        string_contains: searchQuery,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        path: [locale],
                        string_contains: searchQuery,
                        mode: "insensitive",
                    },
                },
            ]
            orGroups.push(searchConditions)
        }

        if (orGroups.length === 1) filters.OR = orGroups[0]
        else if (orGroups.length > 1) andConditions.push(...orGroups.map(group => ({ OR: group })))
        if (andConditions.length) filters.AND = andConditions

        const limit = positiveInt(params.limit) ?? PAGE_SIZE
        const maxLimit = 500
        const safeLimit = Math.min(limit, maxLimit)

        const propertyQueryOptions = {
            include: {
                propertyLocation: true,
                category: true,
                subcategory: true,
                agency: {
                    select: {
                        logo: true,
                    },
                },
            },
            omit: {
                modifications: true,
                autoRenewEnabled: true,
                autoRenewEndDate: true,
                autoRenewStartDate: true,
                builder: true,
                inDevelopment: true,
                featuredUntil: true,
                inDevelopmentUntil: true,
                lastAutoRenewedAt: true,
                ownerId: true,
                orientation: true,
                propertyCadastralMunicipality: true,
                propertyDeed: true,
                propertyPlan: true,
                remarks: true,
                renterId: true,
                video: true,
                yearBuilt: true,
            },
        }

        let properties
        let total
        let totalPages
        let page
        const isMapView = Object.prototype.hasOwnProperty.call(params, "showMap")
        const shouldMixFeatured =
            promoteFeatured &&
            !featuredOnly &&
            !includePending &&
            ids.length === 0 &&
            !isMapView &&
            safeLimit > FEATURED_PER_PAGE

        if (shouldMixFeatured) {
            const normalFilters = appendAndCondition(filters, inactiveFeaturedCondition(now))
            const promotedAndConditions = [activeFeaturedCondition(now)]

            if (!includeHiddenAgencies && HIDDEN_AGENCY_IDS.length) {
                promotedAndConditions.unshift({
                    OR: [{ agencyId: null }, { agencyId: { notIn: HIDDEN_AGENCY_IDS } }],
                })
            }

            promotedAndConditions.push(...hiddenPropertyConditions(capabilities))

            const promotedFilters = {
                status: PropertyStatus.PUBLISHED,
                AND: promotedAndConditions,
            }

            if (country) promotedFilters.country = country
            if (params.agency) promotedFilters.agencyId = stringValue(params.agency)
            if (inDevelopment === true) promotedFilters.inDevelopment = true
            if (params.category) promotedFilters.categoryId = stringValue(params.category)
            if (listingType) promotedFilters.listingType = listingType
            if (location) {
                promotedFilters.propertyLocationId = promotedLocationIds.length ? { in: promotedLocationIds } : location
            }

            const [strictTotal, featuredRows, normalTotal] = await Promise.all([
                prisma.property.count({ where: filters }),
                prisma.property.findMany({
                    where: promotedFilters,
                    select: { id: true },
                    orderBy: { id: "asc" },
                }),
                prisma.property.count({ where: normalFilters }),
            ])

            total = strictTotal
            const featuredIds = featuredRows.map(property => property.id)
            const normalPageSize = featuredIds.length ? safeLimit - FEATURED_PER_PAGE : safeLimit
            totalPages = Math.max(Math.ceil(normalTotal / normalPageSize), featuredIds.length ? 1 : 0)

            page = positiveInt(params.page) ?? 1
            if (page > totalPages && totalPages > 0) page = 1

            const pageFeaturedIds = featuredIdsForPage(featuredIds, page, now.getTime())
            const [featuredProperties, normalProperties] = await Promise.all([
                pageFeaturedIds.length
                    ? prisma.property.findMany({
                          where: { id: { in: pageFeaturedIds } },
                          ...propertyQueryOptions,
                      })
                    : [],
                prisma.property.findMany({
                    where: normalFilters,
                    orderBy,
                    ...propertyQueryOptions,
                    take: normalPageSize,
                    skip: (page - 1) * normalPageSize,
                }),
            ])

            const featuredById = new Map(featuredProperties.map(property => [property.id, property]))
            properties = [
                ...pageFeaturedIds.map(id => featuredById.get(id)).filter(Boolean),
                ...normalProperties.map(property => ({ ...property, featured: false })),
            ]
        } else {
            total = await prisma.property.count({ where: filters })
            totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0
            page = positiveInt(params.page) ?? 1
            page = Math.max(1, Math.min(page, totalPages || 1))
        }

        if (!shouldMixFeatured && shouldShuffleFeatured) {
            const featuredPropertyIds = await prisma.property.findMany({
                where: filters,
                select: {
                    id: true,
                },
                orderBy: { id: "asc" },
            })

            const paginatedIds = featuredIdsForPage(
                featuredPropertyIds.map(property => property.id),
                page,
                now.getTime(),
                safeLimit
            )

            if (paginatedIds.length === 0) {
                properties = []
            } else {
                const shuffledProperties = await prisma.property.findMany({
                    where: {
                        id: {
                            in: paginatedIds,
                        },
                    },
                    ...propertyQueryOptions,
                })

                const propertiesById = new Map(shuffledProperties.map(property => [property.id, property]))
                properties = paginatedIds.map(id => propertiesById.get(id)).filter(Boolean)
            }
        } else if (!shouldMixFeatured) {
            properties = await prisma.property.findMany({
                where: filters,
                orderBy,
                ...propertyQueryOptions,
                take: safeLimit,
                skip: (page - 1) * safeLimit,
            })
        }

        return {
            data: properties,
            message: "Properties loaded successfully",
            pagination: {
                currentPage: page,
                pageSize: safeLimit,
                totalPages,
                total,
                hasMore: page < totalPages,
            },
        }
    } catch (error) {
        console.error("Error loading properties:", error)
        throw new Error("Failed to load properties")
    }
}

/**
 * Get single property by property ID
 * @param {string} propertyId - Property ID
 * @param {Object} [viewContext] - Context used to record a PropertyView
 * @param {string} [viewContext.ip] - Requester IP address
 * @param {string|null} [viewContext.clientId] - Client ID, if known
 * @param {Object} [options] - Internal options (never derived from query params)
 * @param {boolean} [options.includeHiddenAgencies] - Bypass the hidden agency exclusion
 * @param {{ shortTermRent?: boolean }} [options.capabilities] - req.capabilities (defaults to legacy)
 * @returns {Promise<ApiResponse<PropertyWithRelations[]>>}
 */
// App 1.1.0 only (design D §4.2): private seller's first name (never phone or email, design B §6.2, same shape as
// web public API) and whether signed-in viewer owns listing ("Ова е ваш оглас").
const privateListingFields = async (property, viewerSupabaseUserId) => {
    const [client, viewer] = await Promise.all([
        property.clientId
            ? prisma.client.findUnique({
                  where: { id: property.clientId },
                  select: { user: { select: { name: true } } },
              })
            : null,
        viewerSupabaseUserId
            ? prisma.user.findUnique({
                  where: { supabaseUserId: viewerSupabaseUserId },
                  select: { client: { select: { id: true } } },
              })
            : null,
    ])
    return {
        seller: property.clientId ? { type: "private", firstName: firstNameOf(client?.user?.name) } : null,
        viewer: { isOwner: Boolean(property.clientId && viewer?.client?.id === property.clientId) },
    }
}

export const getPropertyService = async (propertyId, viewContext = {}, options = {}) => {
    try {
        const {
            includeHiddenAgencies = false,
            capabilities = LEGACY_CAPABILITIES,
            viewerSupabaseUserId = null,
        } = options

        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            include: {
                agency: true,
                propertyLocation: true,
                createdByMember: {
                    include: {
                        user: true,
                    },
                },
            },
        })

        const hiddenAgency = !includeHiddenAgencies && isHiddenAgency(property?.agencyId)
        // A listing the caller cannot handle answers exactly like a missing id, which older apps show as "not found".
        if (hiddenAgency || (property && !isPropertyVisibleTo(property, capabilities))) {
            return {
                data: null,
                message: "Property loaded successfully",
            }
        }

        if (property) {
            try {
                await prisma.propertyView.create({
                    data: {
                        propertyId: property.id,
                        clientId: viewContext.clientId ?? null,
                        additionalInfo: { ip: viewContext.ip ?? "Unknown" },
                    },
                })
            } catch (viewErr) {
                console.error("Error recording property view:", viewErr)
            }
        }

        const data =
            property && capabilities.clientListings
                ? { ...property, ...(await privateListingFields(property, viewerSupabaseUserId)) }
                : property

        return {
            data,
            message: "Property loaded successfully",
        }
    } catch (err) {
        console.error("Error loading property:", err)
        throw new Error("Failed to load property")
    }
}

const normalizeCountry = value => {
    const country = stringValue(value)?.toLowerCase()
    return country && Object.values(PropertyCountry).includes(country) ? country : undefined
}

const appendAndCondition = (where, condition) => ({
    ...where,
    AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), condition],
})
