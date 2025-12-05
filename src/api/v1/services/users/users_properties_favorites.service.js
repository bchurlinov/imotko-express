import { EngagementType } from "@prisma/client"
import prisma from "#database/client.js"
import createError from "http-errors"

/**
 * @typedef {import('#types/api.js').ApiResponse} ApiResponse
 * @typedef {import('@prisma/client').Prisma.UserGetPayload<{include: {client: true}}>} User
 */

/**
 * Service to add a property to user's favorites
 * @param {string} userId - The ID of the user
 * @param {string} propertyId - The ID of the property to favorite
 * @returns {Promise<ApiResponse<User>>} The created favorite and engagement records
 * @throws {Error} If user's client profile doesn't exist or property doesn't exist
 */
const usersCreatePropertiesFavoriteService = async (userId, propertyId) => {
    // Find the client associated with this user
    const client = await prisma.client.findUnique({
        where: { userId },
    })

    if (!client) throw createError(400, "No client exists with this user ID")

    // Check if property exists
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
    })

    if (!property) throw createError(404, "Property not found")

    const existingFavorite = await prisma.propertyFavorite.findFirst({
        where: {
            clientId: client.id,
            propertyId,
        },
    })

    if (existingFavorite) throw createError(409, "Property is already in favorites")

    const [newFavorite] = await prisma.$transaction([
        prisma.propertyFavorite.create({
            data: {
                favoriteDate: new Date(),
                property: { connect: { id: propertyId } },
                client: { connect: { id: client.id } },
            },
        }),
        prisma.propertyEngagement.create({
            data: {
                propertyId,
                clientId: client.id,
                type: EngagementType.FAVORITE,
            },
        }),
    ])

    return {
        data: newFavorite,
        message: "Property added to favorites successfully",
    }
}

/**
 * Service to remove a property from user's favorites
 * @param {string} userId - The ID of the user
 * @param {string} propertyId - The ID of the property to unfavorite
 * @returns {Promise<{data: object, message: string}>} The deleted favorite record
 * @throws {Error} If user's client profile doesn't exist or favorite doesn't exist
 */
const usersDeletePropertiesFavoriteService = async (userId, propertyId) => {
    // Find the client associated with this user
    const client = await prisma.client.findUnique({
        where: { userId },
    })

    if (!client) throw createError(400, "No client exists with this user ID")

    // Find the favorite record
    const favorite = await prisma.propertyFavorite.findFirst({
        where: {
            clientId: client.id,
            propertyId,
        },
    })

    if (!favorite) throw createError(404, "Favorite not found")

    const deletedFavorite = await prisma.propertyFavorite.delete({
        where: {
            id: favorite.id,
        },
    })

    return {
        data: deletedFavorite,
        message: "Property removed from favorites successfully",
    }
}

/**
 * Service to remove a property from user's favorites
 * @param {string} userId - The ID of the user
 * @returns {Promise<{data: object, message: string}>} The deleted favorite record
 * @throws {Error} If user's client profile doesn't exist or favorite doesn't exist
 */
const getPropertiesFavoritesService = async userId => {
    // Find the client associated with this user
    const client = await prisma.client.findUnique({
        where: { userId },
    })

    if (!client) throw createError(400, "No client exists with this user ID")

    const favorites = await prisma.propertyFavorite.findMany({
        where: {
            clientId: client.id,
        },
        include: {
            property: true,
        },
    })

    return {
        data: favorites,
        message: "User's favorite properties retrieved successfully",
    }
}

export { usersCreatePropertiesFavoriteService, usersDeletePropertiesFavoriteService, getPropertiesFavoritesService }
