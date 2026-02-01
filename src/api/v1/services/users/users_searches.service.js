import prisma from "#database/client.js"
import createError from "http-errors"
import { calculatePagination, createPaginationResponse } from "#utils/pagination/index.js"

/**
 *  @typedef {import('#types/api.js').ApiResponse} ApiResponse
 *  @typedef {import('@prisma/client').Prisma.ClientSearchGetPayload<{ include: any }>} UserSearch
 */

/**
 * Create a new client search
 * @param {string} _userId - User ID (not used, email from body is used instead)
 * @param {object} body - Search data
 * @param {string} body.email - User email
 * @param {Array<{label: string, value: string}>} body.filters - Search filters array
 * @param {string} body.queryString - Query string for the search URL
 * @param {object} body.params - Search parameters (location, listingType, category, subCategory, etc.)
 * @param {string} [body.locale] - Preferred locale for title generation (defaults to 'mk')
 * @returns {Promise<ApiResponse<UserSearch>>}
 */
export const createUserSearchService = async (_userId, body) => {
    try {
        const { email, filters, queryString, params, preferences } = body

        if (!email) throw createError(400, "Email is required")

        if (!queryString) throw createError(400, "Query string is required")

        const user = await prisma.user.findUnique({
            where: { email },
            include: { client: true },
        })

        if (!user) throw createError(404, "User not found")
        if (!user.client) throw createError(400, "User does not have a client profile")

        let categoryData = null
        let subcategoryData = null
        let locationData = null

        if (params?.category) {
            categoryData = await prisma.propertyCategory.findUnique({
                where: { id: params.category },
            })
        }

        if (params?.subCategory) {
            subcategoryData = await prisma.propertySubcategory.findUnique({
                where: { id: params.subCategory },
            })
        }

        if (params?.location) {
            locationData = await prisma.propertyLocation.findFirst({
                where: {
                    name: {
                        equals: params.location,
                        mode: "insensitive",
                    },
                },
            })
        }

        const prepareFilters = filters?.reduce((acc, filter) => {
            acc[filter.label] = filter.value
            return acc
        }, {})

        const createdSearch = await prisma.$transaction(async tx => {
            const nextClientSearch = await tx.clientSearch.create({
                data: {
                    client: { connect: { id: user.client.id } },
                    link: "",
                    title: { mk: "", en: "", sq: "" },
                    filters: prepareFilters || {},
                    receiveOffers: preferences.agencyOffers || false,
                },
            })

            if (!preferences?.matchAlerts) return nextClientSearch
            if (!nextClientSearch?.filters.category)
                throw createError(400, "Category is required for property subscription")

            const propertySubscription = {}
            if (nextClientSearch?.filters.location) propertySubscription.location = nextClientSearch.filters.location
            if (nextClientSearch?.filters.listingType)
                propertySubscription.listingType = nextClientSearch.filters.listingType
            if (nextClientSearch?.filters.category) propertySubscription.category = nextClientSearch.filters.category
            if (nextClientSearch?.filters.subCategory)
                propertySubscription.subCategory = nextClientSearch.filters.subCategory
            if (nextClientSearch?.filters.price_from)
                propertySubscription.minPrice = +nextClientSearch.filters.price_from
            if (nextClientSearch?.filters.price_to) propertySubscription.maxPrice = +nextClientSearch.filters.price_to
            if (nextClientSearch?.filters.size_from) propertySubscription.minSize = +nextClientSearch.filters.size_from
            if (nextClientSearch?.filters.size_to) propertySubscription.maxSize = +nextClientSearch.filters.size_to

            await tx.clientPropertySubscription.create({
                data: {
                    ...propertySubscription,
                    client: { connect: { id: user.client.id } },
                    clientSearch: { connect: { id: nextClientSearch.id } },
                },
            })

            return nextClientSearch
        })

        return {
            data: createdSearch,
            code: 201,
            message: "Search saved successfully",
        }
    } catch (err) {
        console.error("Error creating user search:", err)
        throw createError(500, "Failed to create user search")
    }
}

/**
 * Get all searches for a user with pagination
 * @param {string} userId - User ID
 * @param {object} query - Query parameters
 * @param {string | number | undefined} query.page - Page number (default: 1)
 * @param {string | number | undefined} query.limit - Items per page (default: 15, max: 500)
 * @returns {Promise<ApiResponse<UserSearch[]>>}
 */

export const getUserSearchesService = async (userId, query = {}) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { client: true },
        })

        if (!user) throw createError(404, "User not found")
        if (!user.client) throw createError(400, "User does not have a client profile")

        const total = await prisma.clientSearch.count({
            where: { clientId: user.client.id },
        })

        // Calculate pagination
        const { page, limit, skip, totalPages } = calculatePagination({
            page: query.page,
            limit: query.limit,
            total,
        })

        // Fetch paginated searches
        const searches = await prisma.clientSearch.findMany({
            where: { clientId: user.client.id },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        })

        return {
            data: searches,
            code: 200,
            message: "User searches loaded successfully.",
            pagination: createPaginationResponse({
                currentPage: page,
                pageSize: limit,
                totalPages,
                total,
            }),
        }
    } catch (err) {
        console.error("Error retrieving user searches:", err)
        throw createError(500, "Failed to load user searches")
    }
}

/**
 * Delete a user search
 * @param {string} userId - User ID
 * @param {string} searchId - Search ID
 * @returns {Promise<ApiResponse<null>>}
 */
export const deleteUserSearchService = async (userId, searchId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { client: true },
        })

        if (!user) throw createError(404, "User not found")
        if (!user.client) throw createError(400, "User does not have a client profile")

        const search = await prisma.clientSearch.findUnique({
            where: { id: searchId },
        })

        if (!search) throw createError(404, "Search not found")
        if (search.clientId !== user.client.id)
            throw createError(403, "You do not have permission to delete this search")

        await prisma.clientSearch.delete({
            where: { id: searchId },
        })

        return {
            data: null,
            code: 200,
            message: "User search deleted successfully.",
        }
    } catch (err) {
        console.error("Error deleting user search:", err)
        throw createError(500, "Failed to delete user search")
    }
}
