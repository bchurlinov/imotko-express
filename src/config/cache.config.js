import "dotenv/config"

/**
 * TTL (Time To Live) configuration for different cache types
 * Values are in milliseconds
 * @type {Object.<string, number>}
 */
export const CACHE_TTL = {
    getPropertiesService: parseInt(process.env.CACHE_TTL_GET_PROPERTIES_SERVICE) || 3 * 60 * 1000, // 3 minutes
    getPropertyService: parseInt(process.env.CACHE_TTL_GET_PROPERTIES_SERVICE) || 3 * 60 * 1000, // 3 minutes
    getAgencyByReferer: parseInt(process.env.CACHE_TTL_GET_AGENCY_BY_REFERER) || 3 * 60 * 1000, // 3 minutes
    default: parseInt(process.env.CACHE_TTL_DEFAULT) || 3 * 60 * 1000, // 3 minutes
}

/**
 * LRU cache configuration settings
 * @type {Object}
 * @property {number} max - Maximum number of items to store in cache
 * @property {number} ttl - Default time-to-live in milliseconds
 */
export const CACHE_CONFIG = {
    max: parseInt(process.env.CACHE_MAX_ITEMS) || 500,

    // Limit to ~50MB (10% of total RAM is safer)
    maxSize: parseInt(process.env.CACHE_MAX_SIZE_BYTES) || 50 * 1024 * 1024,

    // 3. Define how to calculate the size of each entry
    // This tells the cache to look at the string length of the data
    sizeCalculation: value => {
        try {
            return JSON.stringify(value).length
        } catch {
            return 1000
        }
    },

    ttl: CACHE_TTL.default, // e.g., 1000 * 60 * 30 (30 mins)
    updateAgeOnGet: true, // "Refresh" the TTL when someone searches the same thing
}
/**
 * Determines if caching is enabled
 * Automatically disabled in test environment
 * Can be manually disabled via CACHE_ENABLED=false
 * @returns {boolean} True if caching should be enabled
 */
export const isCacheEnabled = () => {
    if (process.env.NODE_ENV === "test") return false
    return process.env.CACHE_ENABLED !== "false"
}

/**
 * Cache logging configuration
 * @type {Object}
 * @property {boolean} enabled - Whether to log cache operations
 */
export const CACHE_LOGGING = {
    enabled: process.env.CACHE_LOGGING === "true" || process.env.NODE_ENV === "development",
}
