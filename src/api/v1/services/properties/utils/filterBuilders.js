import { numberValue, parseRangeValue } from "./paramConverters.js"

/**
 * @typedef {import('@generated/prisma').Prisma.IntFilter} IntFilter
 * @typedef {import('@generated/prisma').Prisma.JsonFilter} JsonFilter
 * @typedef {import('@generated/prisma').Prisma.PropertyWhereInput} PropertyWhereInput
 * @typedef {string | number | boolean | string[] | undefined} PrimitiveParam
 */

/**
 * Build numeric filter for Prisma query
 * @param {PrimitiveParam} fromValue
 * @param {PrimitiveParam} toValue
 * @returns {IntFilter | undefined}
 */
export const buildNumericFilter = (fromValue, toValue) => {
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
export const buildPriceFilter = (fromValue, toValue, enforcePositive = false) => {
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
export const buildAttributeFilter = (attributeKey, fromValue, toValue) => {
    const from = numberValue(fromValue)
    const to = parseRangeValue(toValue)

    if (from === undefined && !to) return undefined

    /** @type {JsonFilter} */
    const jsonFilter = {
        path: [attributeKey],
    }

    if (from !== undefined) jsonFilter.gte = from
    if (to) {
        if (to.hasPlus) jsonFilter.gte = Math.max(Number(jsonFilter.gte ?? to.value), to.value)
        else jsonFilter.lte = to.value
    }

    return {
        attributes: jsonFilter,
    }
}
