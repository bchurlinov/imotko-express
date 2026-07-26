import IORedis from "ioredis"

/**
 * Redis client shared by the API process.
 *
 * Tuned for request-path use, unlike the worker connection: commands must fail
 * fast rather than queue, so a Redis outage degrades into fail-open rate
 * limiting instead of hanging every HTTP request.
 *
 * @module config/redis
 */

/** @type {import('ioredis').Redis | null | undefined} */
let client

/**
 * Returns the shared Redis client, or null when Redis is not configured.
 * Connection is created once and reused.
 *
 * @returns {import('ioredis').Redis | null} Redis client, or null when unconfigured
 */
export const getRedisClient = () => {
    if (client !== undefined) return client

    const url = process.env.UPSTASH_REDIS_URL?.trim()
    if (!url) {
        client = null
        return client
    }

    client = new IORedis(url, {
        // Fail fast: a hung Redis must not stall the request path
        maxRetriesPerRequest: 1,
        // Offline queue stays ON. With it off, commands issued before the TLS
        // handshake completes reject immediately ("Stream isn't writeable"),
        // and rate-limit-redis raises those outside any awaited chain - an
        // unhandled rejection, which this process treats as fatal.
        enableOfflineQueue: true,
        connectTimeout: 5000,
        tls: url.startsWith("rediss://") ? {} : undefined,
    })

    // Without a listener ioredis emits an unhandled 'error' event and crashes
    // the process on a transient network blip
    client.on("error", error => {
        console.error("[redis] connection error:", error?.message || error)
    })

    return client
}

/**
 * Closes the shared Redis connection, if one was ever opened
 * @returns {Promise<void>}
 */
export const closeRedisClient = async () => {
    if (!client) return

    try {
        await client.quit()
    } catch {
        client.disconnect()
    } finally {
        client = undefined
    }
}
