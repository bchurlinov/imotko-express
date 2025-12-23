import crypto from "crypto"

/**
 * Normalizes parameters to ensure deterministic cache key generation
 * Recursively sorts object keys, filters undefined values, and handles arrays
 *
 * @param {*} params - Parameters to normalize (can be object, array, primitive, null, or undefined)
 * @returns {*} Normalized parameters
 *
 * @example
 * normalizeParams({ z: 1, a: 2, b: undefined })
 * // Returns: { a: 2, z: 1 }
 *
 * normalizeParams([3, 1, 2])
 * // Returns: [3, 1, 2] (preserves array order)
 */
export function normalizeParams(params) {
    // Handle null and undefined
    if (params === null) return null
    if (params === undefined) return undefined

    // Handle arrays - preserve order but normalize elements
    if (Array.isArray(params)) {
        return params.map((item) => normalizeParams(item))
    }

    // Handle objects - sort keys and filter undefined
    if (typeof params === "object") {
        const normalized = {}
        const sortedKeys = Object.keys(params).sort()

        for (const key of sortedKeys) {
            const value = params[key]
            // Skip undefined values
            if (value !== undefined) {
                normalized[key] = normalizeParams(value)
            }
        }

        return normalized
    }

    // Primitives (string, number, boolean) - return as is
    return params
}

/**
 * Creates an MD5 hash of a string
 *
 * @param {string} str - String to hash
 * @returns {string} Hex digest of the MD5 hash
 *
 * @example
 * hashString('hello world')
 * // Returns: '5eb63bbbe01eeed093cb22bb8f5acdc3'
 */
export function hashString(str) {
    return crypto.createHash("md5").update(str).digest("hex")
}

/**
 * Generates a deterministic cache key from function name and parameters
 * For short keys (<=100 chars), uses JSON serialization
 * For long keys (>100 chars), uses MD5 hash for collision resistance
 *
 * @param {string} functionName - Name of the function being cached
 * @param {*} params - Parameters passed to the function
 * @returns {string} Cache key in format "cache:{functionName}:{hash}" or "cache:{functionName}:{json}"
 *
 * @example
 * // Simple parameters (short key)
 * generateCacheKey('getAgencyByReferer', { referer: 'example.com' })
 * // Returns: 'cache:getAgencyByReferer:{"referer":"example.com"}'
 *
 * @example
 * // Complex parameters (long key - will be hashed)
 * generateCacheKey('getPropertiesService', {
 *   location: 'Skopje',
 *   category: 'apartments',
 *   price: { min: 50000, max: 100000 },
 *   features: ['parking', 'balcony', 'elevator']
 * })
 * // Returns: 'cache:getPropertiesService:a3f2c1b5d4e9f7a1b2c3d4e5f6a7b8c9'
 */
export function generateCacheKey(functionName, params) {
    // Normalize parameters for deterministic serialization
    const normalized = normalizeParams(params)

    // Serialize to JSON
    const serialized = JSON.stringify(normalized)

    // For short keys, use the JSON directly
    if (serialized.length <= 100) {
        return `cache:${functionName}:${serialized}`
    }

    // For long keys, use MD5 hash to prevent key bloat
    const hash = hashString(serialized)
    return `cache:${functionName}:${hash}`
}
