import prisma from "#database/client.js"
import { stringValues } from "./paramConverters.js"

/**
 * @typedef {import('@generated/prisma').Prisma.PropertyOrderByWithRelationInput} PropertyOrderByWithRelationInput
 * @typedef {string | number | boolean | string[] | undefined} PrimitiveParam
 */

export const PROPERTY_SORTS = ["priceAsc", "priceDesc", "dateAsc", "dateDesc"]

/** @type {Record<string, PropertyOrderByWithRelationInput[]>} */
export const ORDER_BY_MAP = {
    priceAsc: [{ price: "asc" }],
    priceDesc: [{ price: "desc" }],
    dateAsc: [{ createdAt: "asc" }],
    dateDesc: [{ createdAt: "desc" }],
}

export const DEFAULT_ORDER_BY = [
    { bumpedAt: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" },
    { updatedAt: "desc" },
]

/**
 * Check if value is a valid property sort
 * @param {string} value
 * @returns {boolean}
 */
export const isPropertySort = value => PROPERTY_SORTS.includes(value)

/**
 * Resolve location IDs including children
 * @param {PrimitiveParam} locationParam
 * @returns {Promise<string[]>}
 */
export const parseLocation = location => {
    if (location.includes("-")) {
        const [city, municipality] = location.split("-")
        return { city, municipality }
    } else {
        return {
            city: location,
            municipality: null,
        }
    }
}

export async function resolveLocationIds(locationName) {
    const loc = parseLocation(locationName)
    const location = await prisma.propertyLocation.findFirst({
        where: { name: loc.municipality ?? loc.city },
    })

    if (!location) return []

    async function getAllLocationIds(locationId) {
        const childLocations = await prisma.propertyLocation.findMany({
            where: { parentId: locationId },
            select: { id: true },
        })

        const childIds = childLocations.map(location => location.id)
        return [locationId, ...childIds]
    }

    return getAllLocationIds(location.id)
}

/**
 * Resolve the city and all its municipalities for promoted search results.
 * A municipality search therefore gives every promoted property in that city a fair chance.
 * @param {PrimitiveParam} locationName
 * @returns {Promise<string[]>}
 */
export async function resolveCityLocationIds(locationName) {
    const rawLocation = stringValues(locationName)[0]
    if (!rawLocation) return []

    const { city, municipality } = parseLocation(rawLocation)
    const location = await prisma.propertyLocation.findFirst({
        where: { name: municipality ?? city },
        select: { id: true, parentId: true },
    })

    if (!location) return []

    const cityId = location.parentId ?? location.id
    const municipalities = await prisma.propertyLocation.findMany({
        where: { parentId: cityId },
        select: { id: true },
    })

    return [cityId, ...municipalities.map(entry => entry.id)]
}
