import { PropertyStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { withCache } from "#utils/cache/index.js"
import { CACHE_TTL } from "#config/cache.config.js"
import {
    stringValue,
    stringValues,
    booleanValue,
    positiveInt,
    buildNumericFilter,
    buildPriceFilter,
    buildAttributeFilter,
    buildPropertyFeaturesFilter,
    isPropertySort,
    resolveLocationIds,
    ORDER_BY_MAP,
    DEFAULT_ORDER_BY,
    PAGE_SIZE,
    DEFAULT_LOCALE,
} from "./utils/index.js"

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
 * @property {PrimitiveParam} [subCategory]
 * @property {PrimitiveParam} [category]
 * @property {PrimitiveParam} [listingType]
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
 * @property {PrimitiveParam} [sortBy]
 * @property {PrimitiveParam} [query]
 * @property {PrimitiveParam} [limit]
 * @property {PrimitiveParam} [page]
 * @property {PrimitiveParam} [locale]
 * @property {PrimitiveParam} [ids]
 */

/**
 * Get properties with filtering, sorting, and pagination
 * @param {PropertyQueryParams} params - Query parameters
 * @returns {Promise<ApiResponse<PropertyWithRelations[]>>}
 */
const _getPropertiesService = async (params = {}) => {
    try {
        const locale = stringValue(params.locale) ?? DEFAULT_LOCALE

        let filters = {
            status: PropertyStatus.PUBLISHED,
        }

        const andConditions = []
        const orGroups = []

        if (params?.featured) filters.featured = true
        const ids = stringValues(params.ids)
        if (ids.length) filters.id = { in: ids }
        if (params.agency) filters.agencyId = stringValue(params.agency)

        const inDevelopment = booleanValue(params.in_development)
        if (typeof inDevelopment === "boolean") filters.inDevelopment = inDevelopment

        if (params.location) {
            const locationIds = await resolveLocationIds(params.location)
            if (locationIds.length) {
                filters.propertyLocationId = { in: locationIds }
            } else {
                const fallbackLocation = stringValue(params.location)
                if (fallbackLocation) filters.propertyLocationId = fallbackLocation
            }
        }

        if (params.subCategory) filters.subcategoryId = stringValue(params.subCategory)
        if (params.category) filters.categoryId = stringValue(params.category)

        const listingType = stringValue(params.listingType)
        if (listingType) filters.listingType = listingType

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

        const sortParam = stringValue(params.sortBy)
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

        const total = await prisma.property.count({ where: filters })
        const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0

        let page = positiveInt(params.page) ?? 1
        page = Math.max(1, Math.min(page, totalPages || 1))

        const properties = await prisma.property.findMany({
            where: filters,
            orderBy,
            include: {
                propertyLocation: true,
                category: true,
                subcategory: true,
            },
            omit: {
                modifications: true,
                externalId: true,
            },
            take: safeLimit,
            skip: (page - 1) * safeLimit,
        })

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

export const getPropertiesService = withCache(_getPropertiesService, {
    keyPrefix: "getPropertiesService",
    ttl: CACHE_TTL.getPropertiesService,
})

/**
 * Get single property by property ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<ApiResponse<PropertyWithRelations[]>>}
 */
export const _getPropertyService = async propertyId => {
    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            include: { agency: true, propertyLocation: true },
        })
        return {
            data: property,
            message: "Property loaded successfully",
        }
    } catch (err) {
        console.error("Error loading property:", err)
        throw new Error("Failed to load property")
    }
}

export const getPropertyService = withCache(_getPropertyService, {
    keyPrefix: "getPropertyService",
    ttl: CACHE_TTL.getPropertyService,
})
