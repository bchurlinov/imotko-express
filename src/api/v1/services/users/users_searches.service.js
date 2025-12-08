import prisma from "#database/client.js"
import createError from "http-errors"

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
        const { email, filters, queryString, params } = body

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
            return tx.clientSearch.create({
                data: {
                    client: { connect: { id: user.client.id } },
                    link: "",
                    title: { mk: "", en: "", sq: "" },
                    filters: prepareFilters || {},
                },
            })
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

export const getUserSearchesService = async userId => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { client: true },
        })

        if (!user) throw createError(404, "User not found")
        if (!user.client) throw createError(400, "User does not have a client profile")

        const searches = await prisma.clientSearch.findMany({
            where: { clientId: user.client.id },
            orderBy: { createdAt: "desc" },
        })

        return {
            data: searches,
            code: 200,
            message: "User searches loaded successfully.",
        }
    } catch (err) {
        console.error("Error retrieving user searches:", err)
        throw createError(500, "Failed to load user searches")
    }
}

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
