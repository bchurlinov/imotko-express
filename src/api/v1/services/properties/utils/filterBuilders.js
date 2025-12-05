import { numberValue, parseRangeValue } from "./paramConverters.js"
import { isValidPropertyFeature } from "./propertyFeatures.js"

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

/**
 * Build property features filter conditions from an array of feature names
 * Creates AND conditions that check if each feature is set to true in the attributes JSON field
 * @param {string[] | string | undefined} propertyFeatures - Array of feature names or comma-separated string
 * @returns {PropertyWhereInput[]} - Array of AND conditions for Prisma query
 */
export const buildPropertyFeaturesFilter = propertyFeatures => {
    if (!propertyFeatures) return []

    // Convert to array if it's a string (handle comma-separated values)
    let featuresArray = []
    if (typeof propertyFeatures === "string") {
        featuresArray = propertyFeatures.split(",").map(f => f.trim())
    } else if (Array.isArray(propertyFeatures)) {
        featuresArray = propertyFeatures
    } else {
        return []
    }

    // Filter to only valid features from the dictionary
    const validFeatures = featuresArray.filter(featureName => isValidPropertyFeature(featureName))

    // Build AND conditions for each valid feature
    const andConditions = validFeatures.map(featureName => ({
        attributes: {
            path: [featureName],
            equals: true,
        },
    }))

    return andConditions
}
