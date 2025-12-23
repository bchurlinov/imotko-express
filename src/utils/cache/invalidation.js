import { cacheManager, isCacheReady } from "#utils/cache/CacheManager.js"
import { generateCacheKey } from "#utils/cache/cacheKey.js"
import { CACHE_LOGGING } from "#config/cache.config.js"

/**
 * Invalidates a specific cache entry based on key prefix and parameters
 * Generates the same cache key that would be used by withCache and removes it
 *
 * @param {string} keyPrefix - The key prefix (function name) used when caching
 * @param {*} params - The parameters used to generate the cache key
 * @returns {boolean} True if the key existed and was deleted, false otherwise
 *
 * @example
 * // Invalidate a specific cached property query
 * invalidateCache('getPropertiesService', {
 *   location: 'Skopje',
 *   category: 'apartments'
 * })
 *
 * @example
 * // Invalidate a specific agency cache
 * invalidateCache('getAgencyByReferer', { referer: 'example.com' })
 */
export function invalidateCache(keyPrefix, params) {
    if (!isCacheReady()) {
        if (CACHE_LOGGING.enabled) {
            console.log("[invalidateCache] Cache not ready, skipping invalidation")
        }
        return false
    }

    try {
        const cacheKey = generateCacheKey(keyPrefix, params)
        const deleted = cacheManager.delete(cacheKey)

        if (CACHE_LOGGING.enabled && deleted) {
            console.log(`[invalidateCache] Invalidated: ${cacheKey}`)
        }

        return deleted
    } catch (error) {
        console.error(`[invalidateCache] Error invalidating cache for ${keyPrefix}:`, error)
        return false
    }
}

/**
 * Invalidates all cache entries matching a wildcard pattern
 * Uses simple string matching (starts with, ends with, contains)
 *
 * @param {string} pattern - Pattern to match cache keys against
 * @returns {number} Number of keys deleted
 *
 * @example
 * // Invalidate all property service caches
 * invalidateCachePattern('cache:getPropertiesService:')
 *
 * @example
 * // Invalidate all agency caches
 * invalidateCachePattern('cache:getAgencyByReferer:')
 *
 * @example
 * // Invalidate caches containing 'Skopje'
 * invalidateCachePattern('Skopje')
 */
export function invalidateCachePattern(pattern) {
    if (!isCacheReady()) {
        if (CACHE_LOGGING.enabled) {
            console.log("[invalidateCachePattern] Cache not ready, skipping invalidation")
        }
        return 0
    }

    try {
        const allKeys = cacheManager.keys()
        let deletedCount = 0

        for (const key of allKeys) {
            // Simple pattern matching - check if key includes the pattern
            if (key.includes(pattern)) {
                const deleted = cacheManager.delete(key)
                if (deleted) {
                    deletedCount++
                }
            }
        }

        if (CACHE_LOGGING.enabled && deletedCount > 0) {
            console.log(`[invalidateCachePattern] Deleted ${deletedCount} keys matching pattern: ${pattern}`)
        }

        return deletedCount
    } catch (error) {
        console.error(`[invalidateCachePattern] Error invalidating pattern "${pattern}":`, error)
        return 0
    }
}

/**
 * Clears all cache entries and resets statistics
 * Use with caution - this will remove ALL cached data
 *
 * @example
 * // Clear all caches (typically during deployment or critical data updates)
 * clearAllCaches()
 */
export function clearAllCaches() {
    if (!isCacheReady()) {
        if (CACHE_LOGGING.enabled) {
            console.log("[clearAllCaches] Cache not ready, nothing to clear")
        }
        return
    }

    try {
        const sizeBefore = cacheManager.size()
        cacheManager.clear()

        if (CACHE_LOGGING.enabled) {
            console.log(`[clearAllCaches] Cleared ${sizeBefore} cache entries`)
        }
    } catch (error) {
        console.error("[clearAllCaches] Error clearing all caches:", error)
    }
}

/**
 * Invalidates all caches related to a specific property
 * Useful when a property is updated, deleted, or its status changes
 *
 * @param {string|number} propertyId - The ID of the property
 * @returns {number} Number of cache entries invalidated
 *
 * @example
 * // After updating a property
 * await updateProperty(propertyId, newData)
 * invalidatePropertyCaches(propertyId)
 *
 * @example
 * // After deleting a property
 * await deleteProperty(propertyId)
 * invalidatePropertyCaches(propertyId)
 */
export function invalidatePropertyCaches(propertyId) {
    if (!isCacheReady()) return 0

    try {
        let totalDeleted = 0

        // Invalidate all getPropertiesService caches
        // Since we don't know which queries included this property,
        // we need to clear all property list caches
        const propertiesDeleted = invalidateCachePattern("cache:getPropertiesService:")
        totalDeleted += propertiesDeleted

        // Invalidate specific property cache if you have one (e.g., getPropertyById)
        // Uncomment and adjust if you add single property caching:
        // const singlePropertyDeleted = invalidateCache('getPropertyById', { id: propertyId })
        // if (singlePropertyDeleted) totalDeleted++

        if (CACHE_LOGGING.enabled && totalDeleted > 0) {
            console.log(`[invalidatePropertyCaches] Invalidated ${totalDeleted} caches for property ${propertyId}`)
        }

        return totalDeleted
    } catch (error) {
        console.error(`[invalidatePropertyCaches] Error invalidating property ${propertyId}:`, error)
        return 0
    }
}

/**
 * Invalidates all caches related to a specific agency
 * Useful when agency data is updated or agency configuration changes
 *
 * @param {string|number} agencyId - The ID of the agency
 * @returns {number} Number of cache entries invalidated
 *
 * @example
 * // After updating agency information
 * await updateAgency(agencyId, newData)
 * invalidateAgencyCaches(agencyId)
 *
 * @example
 * // After changing agency domain/referer settings
 * await updateAgencyDomain(agencyId, newDomain)
 * invalidateAgencyCaches(agencyId)
 */
export function invalidateAgencyCaches(agencyId) {
    if (!isCacheReady()) return 0

    try {
        let totalDeleted = 0

        // Invalidate all agency referer caches
        // Since we don't know which referer maps to this agency,
        // we need to clear all agency referer caches
        const agencyRefererDeleted = invalidateCachePattern("cache:getAgencyByReferer:")
        totalDeleted += agencyRefererDeleted

        // Invalidate property caches that might include this agency
        // Properties filtered by agency will be affected
        const propertiesDeleted = invalidateCachePattern("cache:getPropertiesService:")
        totalDeleted += propertiesDeleted

        if (CACHE_LOGGING.enabled && totalDeleted > 0) {
            console.log(`[invalidateAgencyCaches] Invalidated ${totalDeleted} caches for agency ${agencyId}`)
        }

        return totalDeleted
    } catch (error) {
        console.error(`[invalidateAgencyCaches] Error invalidating agency ${agencyId}:`, error)
        return 0
    }
}
