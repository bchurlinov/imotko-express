import { LRUCache } from "lru-cache"
import { CACHE_CONFIG, CACHE_LOGGING, isCacheEnabled } from "#config/cache.config.js"

/**
 * CacheManager - Singleton wrapper around LRU cache with statistics tracking
 * Provides a unified interface for cache operations with built-in logging and metrics
 *
 * @class
 * @example
 * import { cacheManager } from "#utils/cache/CacheManager.js"
 *
 * // Set a value
 * cacheManager.set("user:123", { name: "John" }, 60000) // 60 second TTL
 *
 * // Get a value
 * const user = cacheManager.get("user:123")
 *
 * // Check stats
 * const stats = cacheManager.getStats()
 * console.log(`Hit rate: ${stats.hitRate}%`)
 */
class CacheManager {
    /**
     * Creates a new CacheManager instance
     * @param {Object} config - Configuration options
     * @param {number} config.max - Maximum number of items to store in cache
     * @param {number} config.ttl - Default time-to-live in milliseconds
     */
    constructor(config) {
        this.cache = new LRUCache({
            max: config.max,
            ttl: config.ttl,
        })

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
        }

        this.loggingEnabled = CACHE_LOGGING.enabled

        if (this.loggingEnabled) {
            console.log(`[CacheManager] Initialized with max=${config.max}, ttl=${config.ttl}ms`)
        }
    }

    /**
     * Retrieves a value from the cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined if not found
     *
     * @example
     * const value = cacheManager.get("cache:getUser:123")
     */
    get(key) {
        try {
            const value = this.cache.get(key)

            if (value !== undefined) {
                this.stats.hits++
                if (this.loggingEnabled) {
                    console.log(`[CacheManager] HIT: ${key}`)
                }
            } else {
                this.stats.misses++
                if (this.loggingEnabled) {
                    console.log(`[CacheManager] MISS: ${key}`)
                }
            }

            return value
        } catch (error) {
            console.error(`[CacheManager] Error getting key "${key}":`, error)
            this.stats.misses++
            return undefined
        }
    }

    /**
     * Stores a value in the cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} [ttl] - Optional custom TTL in milliseconds (overrides default)
     * @returns {boolean} True if successfully set
     *
     * @example
     * cacheManager.set("cache:getUser:123", userData, 60000)
     */
    set(key, value, ttl) {
        try {
            const options = ttl ? { ttl } : {}
            this.cache.set(key, value, options)
            this.stats.sets++

            if (this.loggingEnabled) {
                const ttlInfo = ttl ? ` (TTL: ${ttl}ms)` : ""
                console.log(`[CacheManager] SET: ${key}${ttlInfo}`)
            }

            return true
        } catch (error) {
            console.error(`[CacheManager] Error setting key "${key}":`, error)
            return false
        }
    }

    /**
     * Removes a specific entry from the cache
     * @param {string} key - Cache key to delete
     * @returns {boolean} True if key existed and was deleted
     *
     * @example
     * cacheManager.delete("cache:getUser:123")
     */
    delete(key) {
        try {
            const existed = this.cache.delete(key)
            if (existed) {
                this.stats.deletes++
                if (this.loggingEnabled) {
                    console.log(`[CacheManager] DELETE: ${key}`)
                }
            }
            return existed
        } catch (error) {
            console.error(`[CacheManager] Error deleting key "${key}":`, error)
            return false
        }
    }

    /**
     * Clears all entries from the cache and resets statistics
     *
     * @example
     * cacheManager.clear()
     */
    clear() {
        try {
            this.cache.clear()
            this.stats = {
                hits: 0,
                misses: 0,
                sets: 0,
                deletes: 0,
            }
            if (this.loggingEnabled) {
                console.log("[CacheManager] Cache cleared, stats reset")
            }
        } catch (error) {
            console.error("[CacheManager] Error clearing cache:", error)
        }
    }

    /**
     * Returns all cache keys
     * @returns {string[]} Array of all keys in cache
     *
     * @example
     * const keys = cacheManager.keys()
     * console.log(`Cache contains ${keys.length} keys`)
     */
    keys() {
        try {
            return Array.from(this.cache.keys())
        } catch (error) {
            console.error("[CacheManager] Error getting keys:", error)
            return []
        }
    }

    /**
     * Returns the current number of items in cache
     * @returns {number} Number of cached items
     *
     * @example
     * const size = cacheManager.size()
     */
    size() {
        try {
            return this.cache.size
        } catch (error) {
            console.error("[CacheManager] Error getting size:", error)
            return 0
        }
    }

    /**
     * Returns cache statistics
     * @returns {Object} Statistics object with hits, misses, sets, deletes, hitRate, size, and max
     *
     * @example
     * const stats = cacheManager.getStats()
     * console.log(`Hit rate: ${stats.hitRate}%`)
     * console.log(`Cache usage: ${stats.size}/${stats.max}`)
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses
        const hitRate = totalRequests > 0 ? ((this.stats.hits / totalRequests) * 100).toFixed(2) : "0.00"

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            hitRate: `${hitRate}%`,
            size: this.size(),
            max: CACHE_CONFIG.max,
        }
    }
}

/**
 * Singleton instance of CacheManager
 * Only created if caching is enabled
 * @type {CacheManager|null}
 */
export const cacheManager = isCacheEnabled() ? new CacheManager(CACHE_CONFIG) : null

/**
 * Helper function to check if cache manager is available
 * @returns {boolean} True if cache manager is initialized and ready
 */
export const isCacheReady = () => cacheManager !== null
