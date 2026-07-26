import { RedisStore } from "rate-limit-redis"
import { getRedisClient } from "#config/redis.js"

/**
 * Shared rate limit store factory.
 *
 * Without a shared store each Railway replica keeps its own in-memory counters,
 * so the effective limit is multiplied by the replica count and every redeploy
 * resets it to zero. Backing the limiters with Redis makes the limit hold
 * across replicas and survive restarts.
 *
 * @module config/rateLimit
 */

/**
 * Builds a Redis-backed store for a limiter.
 *
 * Returns undefined when Redis is not configured, which leaves the limiter on
 * express-rate-limit's default MemoryStore - correct for local development and
 * single-process runs.
 *
 * @param {string} prefix - Key namespace, unique per limiter so buckets never collide
 * @returns {import('express-rate-limit').Store | undefined} Store, or undefined for the default
 */
export const createRateLimitStore = prefix => {
    const redis = getRedisClient()
    if (!redis) return undefined

    const store = new RedisStore({
        prefix: `rl:${prefix}:`,
        // rate-limit-redis is client-agnostic; it drives ioredis through `call`
        sendCommand: (...args) => redis.call(...args),
    })

    guardScriptPromise(store, "incrementScriptSha")
    guardScriptPromise(store, "getScriptSha")

    return store
}

/**
 * Marks rate-limit-redis's cached script promises as handled.
 *
 * Its constructor does `this.incrementScriptSha = this.loadIncrementScript()`
 * without awaiting or catching, and `increment()` reassigns the same field on
 * failure. When Redis is unreachable every one of those promises rejects with
 * nothing attached, producing `unhandledRejection` - which this process treats
 * as fatal, so a Redis outage would take the entire API down with it.
 *
 * Intercepting assignment attaches a no-op catch to each promise as it is set.
 * The rejection still reaches the code that awaits it, so `increment()` retries
 * and `passOnStoreError` fails the request open as intended.
 *
 * @param {object} store - RedisStore instance
 * @param {string} property - Promise-valued field to guard
 * @returns {void}
 */
const guardScriptPromise = (store, property) => {
    const attach = value => {
        if (typeof value?.catch === "function") value.catch(() => {})
        return value
    }

    let current = attach(store[property])

    Object.defineProperty(store, property, {
        configurable: true,
        enumerable: true,
        get: () => current,
        set: value => {
            current = attach(value)
        },
    })
}

/**
 * Options every limiter shares.
 *
 * `passOnStoreError` is the important one: if Redis is unreachable the request
 * is allowed through rather than returning 500. A rate limiter outage must
 * degrade availability of the limit, not of the API.
 *
 * @type {{ passOnStoreError: boolean }}
 */
export const sharedRateLimitOptions = {
    passOnStoreError: true,
}
