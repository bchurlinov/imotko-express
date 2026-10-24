const PRIVATE_IPV4 = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./]

/**
 * Whether a Redis host is only reachable from this machine or its Docker network.
 * Single-label names are Docker service names or aliases (e.g. `imotko-redis` on dokploy-network).
 *
 * @param {string} hostname - URL hostname
 * @returns {boolean}
 */
export const isInternalRedisHost = hostname => {
    if (!hostname) return false
    if (hostname === "localhost" || hostname === "[::1]") return true
    if (PRIVATE_IPV4.some(pattern => pattern.test(hostname))) return true
    return !hostname.includes(".") && !hostname.includes(":")
}

/**
 * Accepts `rediss://` anywhere, and plain `redis://` only to an internal host: without TLS the password and every
 * job travel unencrypted, which is fine inside the VPS Docker network and never over the internet.
 *
 * @param {string} url - Redis connection URL
 * @param {string} [key] - Env var name used in the error message
 * @returns {string} The same URL
 */
export const assertRedisUrl = (url, key = "UPSTASH_REDIS_URL") => {
    let parsed
    try {
        parsed = new URL(url)
    } catch {
        throw new Error(`${key} must be a valid Redis URL`)
    }

    if (parsed.protocol === "rediss:") return url
    if (parsed.protocol === "redis:" && isInternalRedisHost(parsed.hostname)) return url
    throw new Error(`${key} must use rediss://, or redis:// to an internal host (e.g. imotko-redis)`)
}

/**
 * ioredis `tls` option for a URL already checked by assertRedisUrl
 * @param {string} url - Redis connection URL
 * @returns {object | undefined}
 */
export const redisTlsOptions = url => (new URL(url).protocol === "rediss:" ? {} : undefined)
