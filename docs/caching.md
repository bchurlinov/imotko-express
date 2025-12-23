Caching Layer Implementation Plan

Overview

Implement an in-memory LRU caching layer using the lru-cache npm package for frequently-called service functions. Focus on getPropertiesService (30 min TTL) and getAgencyByReferer (5 min TTL).

Architecture: Service-Level Decorator Pattern

Approach: Wrap service functions with a caching decorator without touching controllers or business logic.

Why This Works:
- Controllers already call services directly: await getPropertiesService(req.query)
- Decorator preserves function signatures and JSDoc types
- Easy to enable/disable per function
- Automatic cache bypass in test environments

Implementation Steps

Phase 1: Foundation (Core Infrastructure)

1.1 Install lru-cache Package

- File: package.json
- Action: Add "lru-cache": "^10.0.0" to dependencies
- Command: npm install

1.2 Create Cache Configuration

- File: src/config/cache.config.js (new)
- Pattern: Follow src/config/supabase.js structure
- Content:
  import "dotenv/config"

// TTL configuration (milliseconds)
export const CACHE_TTL = {
getPropertiesService: parseInt(process.env.CACHE_TTL_GET_PROPERTIES_SERVICE) || 30 * 60 * 1000,
getAgencyByReferer: parseInt(process.env.CACHE_TTL_GET_AGENCY_BY_REFERER) || 5 * 60 * 1000,
default: parseInt(process.env.CACHE_TTL_DEFAULT) || 5 * 60 * 1000
}

// LRU cache settings
export const CACHE_CONFIG = {
max: parseInt(process.env.CACHE_MAX_SIZE) || 500,
ttl: CACHE_TTL.default
}

// Enable/disable logic
export const isCacheEnabled = () => {
if (process.env.NODE_ENV === 'test') return false
return process.env.CACHE_ENABLED !== 'false'
}

// Logging configuration
export const CACHE_LOGGING = {
enabled: process.env.CACHE_LOGGING === 'true' || process.env.NODE_ENV === 'development'
}

1.3 Create Cache Key Generator

- File: src/utils/cache/cacheKey.js (new)
- Purpose: Generate deterministic cache keys from function params
- Key Strategy:
    - Normalize params (sort keys, handle undefined/null)
    - Serialize to JSON
    - Hash with MD5 for long keys (>100 chars)
    - Format: cache:{functionName}:{hash}

1.4 Create Cache Manager Singleton

- File: src/utils/cache/CacheManager.js (new)
- Purpose: Wrapper around LRU cache with statistics tracking
- Methods:
    - get(key) - Retrieve from cache (track hits/misses)
    - set(key, value, ttl) - Store in cache
    - delete(key) - Remove specific entry
    - clear() - Clear all entries
    - keys() - Get all cache keys
    - size() - Get cache size
    - getStats() - Get hit/miss statistics

Phase 2: Caching Logic

2.1 Create Caching Decorator

- File: src/utils/cache/withCache.js (new)
- Purpose: Decorator function to wrap service functions with caching
- Signature: withCache(fn, { keyPrefix, ttl })
- Logic:
  a. Generate cache key from function name + params
  b. Check cache, return if hit
  c. On miss: call original function
  d. Store result in cache (only if successful)
  e. Return result

2.2 Create Cache Invalidation Utilities

- File: src/utils/cache/invalidation.js (new)
- Functions:
    - invalidateCache(keyPrefix, params) - Invalidate specific cache entry
    - invalidateCachePattern(pattern) - Invalidate by wildcard pattern
    - clearAllCaches() - Clear entire cache
    - invalidatePropertyCaches(propertyId) - Helper for property invalidation
    - invalidateAgencyCaches(agencyId) - Helper for agency invalidation

2.3 Create Main Export Index

- File: src/utils/cache/index.js (new)
- Purpose: Single entry point for all cache utilities
- Exports: withCache, invalidateCache, invalidateCachePattern, clearAllCaches, getCacheStats

Phase 3: Service Integration

3.1 Wrap getPropertiesService

- File: src/api/v1/services/properties/properties.service.js
- Changes:
  import { withCache } from '#utils/cache/index.js'
  import { CACHE_TTL } from '#config/cache.config.js'

// Rename original function with underscore prefix
const _getPropertiesService = async (params = {}) => {
// ... existing logic unchanged ...
}

// Export cached version
export const getPropertiesService = withCache(
_getPropertiesService,
{
keyPrefix: 'getPropertiesService',
ttl: CACHE_TTL.getPropertiesService  // 30 minutes
}
)

3.2 Wrap getAgencyByReferer

- File: src/api/v1/services/website/website.service.js
- Changes:
  import { withCache } from '#utils/cache/index.js'
  import { CACHE_TTL } from '#config/cache.config.js'

// Rename original function
const _getAgencyByReferer = async (referer) => {
// ... existing logic unchanged ...
}

// Export cached version
export const getAgencyByReferer = withCache(
_getAgencyByReferer,
{
keyPrefix: 'getAgencyByReferer',
ttl: CACHE_TTL.getAgencyByReferer  // 5 minutes
}
)

Phase 4: Configuration

4.1 Update Environment Variables

- File: .env.example
- Add:
# Cache Configuration
CACHE_ENABLED=true
CACHE_MAX_SIZE=500
CACHE_TTL_DEFAULT=300000
CACHE_TTL_GET_PROPERTIES_SERVICE=1800000
CACHE_TTL_GET_AGENCY_BY_REFERER=300000
CACHE_LOGGING=true

4.2 Update Project Documentation

- File: CLAUDE.md
- Add section: "Caching Layer" with architecture overview, usage patterns, and invalidation strategy

Cache Key Generation Strategy

For getPropertiesService (complex query object):
- Params include: location, category, subCategory, listingType, size, price, rooms, features, sortBy, page, limit, locale, ids, agency, featured, in_development
- Strategy: Normalize object (sort keys, remove undefined), serialize to JSON, hash with MD5
- Example key: cache:getPropertiesService:a3f2c1b5d4e9f7a1b2c3d4e5f6a7b8c9

For getAgencyByReferer (simple string param):
- Param: referer URL (normalized)
- Strategy: Simple JSON serialization (no hash needed)
- Example key: cache:getAgencyByReferer:{"referer":"example.com"}

Testing Considerations

- Auto-disable in tests: isCacheEnabled() returns false when NODE_ENV=test
- Manual control: Set CACHE_ENABLED=false to disable completely
- Cache clearing: Import clearAllCaches() in test setup if needed

Expected Performance Impact

getPropertiesService (30 min cache):

- Current: ~200-500ms (complex query with joins, filters, pagination)
- Cached: ~1-5ms
- Improvement: 40-500x faster on cache hits
- Hit Rate: Expected 80-90% (popular filter combinations reused)

getAgencyByReferer (5 min cache):

- Current: ~50-150ms (regex raw SQL query)
- Cached: ~1-3ms
- Improvement: 50-150x faster on cache hits
- Hit Rate: Expected 90-95% (same domains repeatedly access)

Memory Usage:

- Per Item: ~2-50KB (varies by result size)
- Max Memory: ~1-25MB (500 items × average size)
- LRU Eviction: Automatic memory management

Critical Files

Files to Create:

1. src/config/cache.config.js - Cache configuration
2. src/utils/cache/CacheManager.js - LRU cache singleton
3. src/utils/cache/cacheKey.js - Key generation utilities
4. src/utils/cache/withCache.js - Caching decorator
5. src/utils/cache/invalidation.js - Invalidation utilities
6. src/utils/cache/index.js - Main exports

Files to Modify:

1. package.json - Add lru-cache dependency
2. src/api/v1/services/properties/properties.service.js - Wrap getPropertiesService
3. src/api/v1/services/website/website.service.js - Wrap getAgencyByReferer
4. .env.example - Add cache configuration
5. CLAUDE.md - Document caching architecture

Future Extensibility

- More services: Just wrap with withCache(fn, options)
- Custom key generators: Pass keyGenerator option for complex scenarios
- Redis backend: Replace CacheManager implementation without API changes
- Multi-tier caching: Add L1 (memory) + L2 (Redis) cache layers
- Cache monitoring: Add admin endpoint using getCacheStats()

Rollback Strategy

If caching causes issues:
1. Set CACHE_ENABLED=false in .env (immediate disable)
2. Remove withCache wrappers from services (restore original exports)
3. Services continue working unchanged (business logic untouched)