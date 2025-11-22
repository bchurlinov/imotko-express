import prisma from "#database/client.js"
import { PropertyStatus } from "@prisma/client"

/**
 * @typedef {import('@/types/api.js').ApiResponse} ApiResponse
 * @typedef {import('@generated/prisma').Prisma.PropertyGetPayload<{include: {agency: true}}>} PropertyWithRelations
 * @typedef {import('@generated/prisma').Prisma.PropertyWhereInput} PropertyWhereInput
 * @typedef {import('@generated/prisma').Prisma.PropertyOrderByWithRelationInput} PropertyOrderByWithRelationInput
 * @typedef {import('@generated/prisma').Prisma.PropertySelect} PropertySelect
 * @typedef {import('@generated/prisma').Prisma.IntFilter} IntFilter
 * @typedef {import('@generated/prisma').Prisma.JsonFilter} JsonFilter
 * @typedef {string | number | boolean | string[] | undefined} PrimitiveParam
 */

/**
 * @typedef {Object} PropertyQueryParams
 * @property {PrimitiveParam} [agency]
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
 * @property {PrimitiveParam} [sortBy]
 * @property {PrimitiveParam} [query]
 * @property {PrimitiveParam} [limit]
 * @property {PrimitiveParam} [page]
 * @property {PrimitiveParam} [locale]
 */

const PAGE_SIZE = 15
const DEFAULT_LOCALE = "mk"

const PROPERTY_SORTS = ["priceAsc", "priceDesc", "dateAsc", "dateDesc"]

/** @type {Record<string, PropertyOrderByWithRelationInput[]>} */
const ORDER_BY_MAP = {
    priceAsc: [{ price: "asc" }],
    priceDesc: [{ price: "desc" }],
    dateAsc: [{ createdAt: "asc" }],
    dateDesc: [{ createdAt: "desc" }],
}

const DEFAULT_ORDER_BY = [{ bumpedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { updatedAt: "desc" }]

/** @type {PropertySelect} */
const propertySelect = {
    id: true,
    propertyLocation: true,
}

/**
 * Get properties with filtering, sorting, and pagination
 * @param {PropertyQueryParams} params - Query parameters
 * @returns {Promise<ApiResponse<PropertyWithRelations[]>>}
 */
export const getProperties = async (params = {}) => {
    try {
        const locale = stringValue(params.locale) ?? DEFAULT_LOCALE

        /** @type {PropertyWhereInput} */
        const filters = {
            status: PropertyStatus.PUBLISHED,
        }

        /** @type {PropertyWhereInput[]} */
        const andConditions = []
        /** @type {PropertyWhereInput[][]} */
        const orGroups = []

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

        if (orGroups.length === 1) {
            filters.OR = orGroups[0]
        } else if (orGroups.length > 1) {
            andConditions.push(...orGroups.map(group => ({ OR: group })))
        }

        if (andConditions.length) {
            filters.AND = andConditions
        }

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
            select: propertySelect,
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
        console.error("Error fetching properties:", error)
        throw new Error("Failed to fetch properties")
    }
}

/**
 * Convert primitive parameter to string
 * @param {PrimitiveParam} value
 * @returns {string | undefined}
 */
const stringValue = value => {
    if (value === undefined || value === null) return undefined
    if (Array.isArray(value)) return stringValue(value[0])
    if (typeof value === "string") {
        const trimmed = value.trim()
        return trimmed.length ? trimmed : undefined
    }
    if (typeof value === "number" && Number.isFinite(value)) return value.toString()
    if (typeof value === "boolean") return value.toString()
    return undefined
}

/**
 * Convert primitive parameter to string array
 * @param {PrimitiveParam} value
 * @returns {string[]}
 */
const stringValues = value => {
    if (Array.isArray(value)) return value.flatMap(entry => stringValues(entry))
    const single = stringValue(value)
    if (!single) return []
    return single
        .split(",")
        .map(token => token.trim())
        .filter(Boolean)
}

/**
 * Convert primitive parameter to number
 * @param {PrimitiveParam} value
 * @returns {number | undefined}
 */
const numberValue = value => {
    const raw = stringValue(value)
    if (!raw) return undefined
    const numeric = Number(raw)
    return Number.isFinite(numeric) ? numeric : undefined
}

/**
 * Convert primitive parameter to boolean
 * @param {PrimitiveParam} value
 * @returns {boolean | undefined}
 */
const booleanValue = value => {
    if (typeof value === "boolean") return value
    const normalized = stringValue(value)?.toLowerCase()
    if (!normalized) return undefined
    if (["true", "1", "yes"].includes(normalized)) return true
    if (["false", "0", "no"].includes(normalized)) return false
    return undefined
}

/**
 * Convert primitive parameter to positive integer
 * @param {PrimitiveParam} value
 * @returns {number | undefined}
 */
const positiveInt = value => {
    const numeric = numberValue(value)
    if (numeric === undefined) return undefined
    if (numeric <= 0) return undefined
    return Math.floor(numeric)
}

/**
 * Parse range value (e.g., "100+")
 * @param {PrimitiveParam} value
 * @returns {{value: number, hasPlus: boolean} | undefined}
 */
const parseRangeValue = value => {
    const raw = stringValue(value)
    if (!raw) return undefined
    const hasPlus = raw.endsWith("+")
    const numericPart = Number(hasPlus ? raw.slice(0, -1) : raw)
    if (!Number.isFinite(numericPart)) return undefined
    return {
        value: numericPart,
        hasPlus,
    }
}

/**
 * Build numeric filter for Prisma query
 * @param {PrimitiveParam} fromValue
 * @param {PrimitiveParam} toValue
 * @returns {IntFilter | undefined}
 */
const buildNumericFilter = (fromValue, toValue) => {
    /** @type {IntFilter} */
    const filter = {}
    const from = numberValue(fromValue)
    if (from !== undefined) filter.gte = from

    const to = parseRangeValue(toValue)
    if (to) {
        if (to.hasPlus) {
            filter.gte = Math.max(filter.gte ?? to.value, to.value)
        } else {
            filter.lte = to.value
        }
    }

    return Object.keys(filter).length ? filter : undefined
}

/**
 * Build price filter for Prisma query
 * @param {PrimitiveParam} fromValue
 * @param {PrimitiveParam} toValue
 * @param {boolean} enforcePositive
 * @returns {IntFilter | undefined}
 */
const buildPriceFilter = (fromValue, toValue, enforcePositive = false) => {
    /** @type {IntFilter} */
    const filter = enforcePositive ? { gt: 0 } : {}
    const from = numberValue(fromValue)
    if (from !== undefined) filter.gte = Math.max(enforcePositive ? 1 : from, from)

    const to = parseRangeValue(toValue)
    if (to) {
        if (to.hasPlus) {
            const minPrice = from !== undefined ? Math.max(from, to.value) : to.value
            filter.gte = Math.max(filter.gte ?? minPrice, minPrice)
        } else {
            filter.lte = to.value
        }
    }

    return Object.keys(filter).length ? filter : undefined
}

/**
 * Build attribute filter for JSON fields
 * @param {string} attributeKey
 * @param {PrimitiveParam} fromValue
 * @param {PrimitiveParam} toValue
 * @returns {PropertyWhereInput | undefined}
 */
const buildAttributeFilter = (attributeKey, fromValue, toValue) => {
    const from = numberValue(fromValue)
    const to = parseRangeValue(toValue)

    if (from === undefined && !to) return undefined

    /** @type {JsonFilter} */
    const jsonFilter = {
        path: [attributeKey],
    }

    if (from !== undefined) jsonFilter.gte = from
    if (to) {
        if (to.hasPlus) {
            jsonFilter.gte = Math.max(Number(jsonFilter.gte ?? to.value), to.value)
        } else {
            jsonFilter.lte = to.value
        }
    }

    return {
        attributes: jsonFilter,
    }
}

/**
 * Check if value is a valid property sort
 * @param {string} value
 * @returns {boolean}
 */
const isPropertySort = value => PROPERTY_SORTS.includes(value)

/**
 * Resolve location IDs including children
 * @param {PrimitiveParam} locationParam
 * @returns {Promise<string[]>}
 */
const resolveLocationIds = async locationParam => {
    const requestedLocations = stringValues(locationParam)
    if (!requestedLocations.length) return []

    const baseLocations = await prisma.propertyLocation.findMany({
        where: {
            OR: [
                { id: { in: requestedLocations } },
                {
                    name: {
                        in: requestedLocations,
                        mode: "insensitive",
                    },
                },
            ],
        },
        select: { id: true },
    })

    if (!baseLocations.length) return []

    const discovered = new Set(baseLocations.map(location => location.id))
    let frontier = [...discovered]

    while (frontier.length) {
        const children = await prisma.propertyLocation.findMany({
            where: {
                parentId: { in: frontier },
            },
            select: { id: true },
        })

        const newIds = children.map(child => child.id).filter(id => !discovered.has(id))
        if (!newIds.length) break
        newIds.forEach(id => discovered.add(id))
        frontier = newIds
    }

    return Array.from(discovered)
}
