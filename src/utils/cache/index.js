/**
 * Cache Utilities - Main Export Module
 *
 * This module provides a unified interface for all caching functionality.
 * Import from this file to access caching decorators, invalidation utilities,
 * and cache statistics.
 *
 * @module utils/cache
 *
 * @example
 * // Import caching utilities
 * import { withCache, invalidateCache, getCacheStats } from '#utils/cache/index.js'
 *
 * // Wrap a service function with caching
 * const cachedService = withCache(myService, {
 *   keyPrefix: 'myService',
 *   ttl: 300000 // 5 minutes
 * })
 *
 * // Invalidate specific cache
 * invalidateCache('myService', { id: 123 })
 *
 * // Get cache statistics
 * const stats = getCacheStats()
 * console.log(`Hit rate: ${stats.hitRate}`)
 */

// Core caching decorator
export { withCache } from "#utils/cache/withCache.js"

// Cache invalidation utilities
export {
    invalidateCache,
    invalidateCachePattern,
    clearAllCaches,
    invalidatePropertyCaches,
    invalidateAgencyCaches,
} from "#utils/cache/invalidation.js"

// Cache manager and utilities
export { cacheManager, isCacheReady } from "#utils/cache/CacheManager.js"

// Cache key utilities (for advanced usage)
export { generateCacheKey, normalizeParams } from "#utils/cache/cacheKey.js"

/**
 * Gets current cache statistics
 * Returns hit/miss counts, hit rate percentage, and cache size
 *
 * @returns {Object|null} Statistics object or null if cache is not ready
 * @property {number} hits - Number of cache hits
 * @property {number} misses - Number of cache misses
 * @property {number} sets - Number of cache sets
 * @property {number} deletes - Number of cache deletions
 * @property {string} hitRate - Hit rate as percentage string (e.g., "85.50%")
 * @property {number} size - Current number of items in cache
 * @property {number} max - Maximum cache size
 *
 * @example
 * import { getCacheStats } from '#utils/cache/index.js'
 *
 * const stats = getCacheStats()
 * if (stats) {
 *   console.log(`Cache Statistics:`)
 *   console.log(`- Hit Rate: ${stats.hitRate}`)
 *   console.log(`- Cache Usage: ${stats.size}/${stats.max}`)
 *   console.log(`- Total Requests: ${stats.hits + stats.misses}`)
 * }
 */
export function getCacheStats() {
    if (!cacheManager) return null
    return cacheManager.getStats()
}
