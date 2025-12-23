import { cacheManager, isCacheReady } from "#utils/cache/CacheManager.js"
import { generateCacheKey } from "#utils/cache/cacheKey.js"
import { CACHE_LOGGING } from "#config/cache.config.js"

/**
 * Decorator function that wraps a service function with caching logic
 * Automatically generates cache keys, checks cache before execution, and stores results
 *
 * @param {Function} fn - The async function to wrap with caching
 * @param {Object} options - Caching options
 * @param {string} options.keyPrefix - Prefix for cache keys (typically the function name)
 * @param {number} [options.ttl] - Time-to-live in milliseconds (optional, uses cache default if not specified)
 * @param {Function} [options.keyGenerator] - Custom key generator function(params) => string (optional)
 * @returns {Function} Wrapped function with caching behavior
 *
 * @example
 * // Basic usage
 * const cachedGetUser = withCache(getUserFromDb, {
 *   keyPrefix: 'getUser',
 *   ttl: 60000 // 60 seconds
 * })
 *
 * // With custom key generator
 * const cachedGetProperties = withCache(getPropertiesFromDb, {
 *   keyPrefix: 'getProperties',
 *   ttl: 300000, // 5 minutes
 *   keyGenerator: (params) => `custom:${params.location}:${params.category}`
 * })
 *
 * @example
 * // Wrapping an existing service function
 * const _getPropertiesService = async (params = {}) => {
 *   // ... original logic ...
 * }
 *
 * export const getPropertiesService = withCache(_getPropertiesService, {
 *   keyPrefix: 'getPropertiesService',
 *   ttl: CACHE_TTL.getPropertiesService
 * })
 */
export function withCache(fn, options) {
    const { keyPrefix, ttl, keyGenerator } = options

    if (!keyPrefix) throw new Error("withCache: keyPrefix is required in options")
    if (typeof fn !== "function") throw new Error("withCache: first argument must be a function")

    /**
     * Wrapped function that implements caching logic
     * @param {...*} args - Arguments to pass to the original function
     * @returns {Promise<*>} Result from cache or original function
     */
    return async function cachedFunction(...args) {
        // If cache is not ready/enabled, bypass caching and call original function
        if (!isCacheReady()) {
            if (CACHE_LOGGING.enabled) {
                console.log(`[withCache] Cache disabled, bypassing for ${keyPrefix}`)
            }
            return await fn(...args)
        }

        try {
            // Generate cache key
            // For single parameter functions, use first arg directly
            // For multiple parameters, use args array
            const params = args.length === 1 ? args[0] : args
            const cacheKey = keyGenerator ? keyGenerator(params) : generateCacheKey(keyPrefix, params)

            // Check cache first
            const cachedResult = cacheManager.get(cacheKey)
            if (cachedResult !== undefined) {
                // Cache hit - return cached result
                return cachedResult
            }

            // Cache miss - call original function
            if (CACHE_LOGGING.enabled) {
                console.log(`[withCache] Executing ${keyPrefix} (cache miss)`)
            }

            const result = await fn(...args)

            // Store result in cache (only if result is not undefined/null)
            // This prevents caching of empty/error results
            if (result !== undefined && result !== null) {
                cacheManager.set(cacheKey, result, ttl)
            } else {
                if (CACHE_LOGGING.enabled) {
                    console.log(`[withCache] Not caching null/undefined result for ${keyPrefix}`)
                }
            }

            return result
        } catch (error) {
            // On error, don't cache and propagate the error
            console.error(`[withCache] Error in ${keyPrefix}:`, error)
            throw error
        }
    }
}
