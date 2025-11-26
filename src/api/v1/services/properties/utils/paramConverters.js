/**
 * @typedef {string | number | boolean | string[] | undefined} PrimitiveParam
 */

/**
 * Convert primitive parameter to string
 * @param {PrimitiveParam} value
 * @returns {string | undefined}
 */
export const stringValue = value => {
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
export const stringValues = value => {
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
export const numberValue = value => {
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
export const booleanValue = value => {
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
export const positiveInt = value => {
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
export const parseRangeValue = value => {
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
