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

export const DEFAULT_ORDER_BY = [{ bumpedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { updatedAt: "desc" }]

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
export const resolveLocationIds = async locationParam => {
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
