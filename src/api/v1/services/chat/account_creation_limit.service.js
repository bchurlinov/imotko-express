import crypto from "node:crypto"
import net from "node:net"
import { getRedisClient } from "#config/redis.js"

const LIMITS = Object.freeze({ burst: [5, 10 * 60], daily: [20, 24 * 60 * 60], global: [100, 60 * 60] })

const expandIpv6 = address => {
    const [left, right = ""] = address.toLowerCase().split("::")
    const leftParts = left ? left.split(":") : []
    const rightParts = right ? right.split(":") : []
    return [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill("0"), ...rightParts]
}

export const accountCreationIpKey = rawIp => {
    const raw = typeof rawIp === "string" ? rawIp.trim().replace(/^::ffff:/i, "") : ""
    const kind = net.isIP(raw)
    if (kind === 4) return raw
    if (kind === 6)
        return expandIpv6(raw)
            .slice(0, 4)
            .map(part => part.padStart(4, "0"))
            .join(":")
    return null
}

const keyFor = (name, ipKey = null) => `chat:account-creation:${name}:${ipKey || "all"}`

const logUnavailable = (operation, error) =>
    console.error("[chat-account-limit] Redis unavailable; failing open", {
        operation,
        error: error instanceof Error ? error.message : String(error),
    })

export const isAccountCreationBlocked = async ip => {
    const redis = getRedisClient()
    if (!redis) return false
    const ipKey = accountCreationIpKey(ip)
    const now = Date.now()
    const checks = [[keyFor("global"), LIMITS.global]]
    if (ipKey) checks.push([keyFor("burst", ipKey), LIMITS.burst], [keyFor("daily", ipKey), LIMITS.daily])
    try {
        const counts = await Promise.all(
            checks.map(([key, [, seconds]]) => redis.zcount(key, now - seconds * 1000, "+inf"))
        )
        return counts.some((count, index) => count >= checks[index][1][0])
    } catch (error) {
        logUnavailable("preflight", error)
        return false
    }
}

export const recordAccountCreation = async ip => {
    const redis = getRedisClient()
    if (!redis) return
    const ipKey = accountCreationIpKey(ip)
    const now = Date.now()
    const token = `${now}:${crypto.randomUUID()}`
    const writes = [[keyFor("global"), LIMITS.global]]
    if (ipKey) writes.push([keyFor("burst", ipKey), LIMITS.burst], [keyFor("daily", ipKey), LIMITS.daily])
    try {
        const pipeline = redis.pipeline()
        for (const [key, [, seconds]] of writes) {
            pipeline.zadd(key, now, token)
            pipeline.expire(key, seconds)
        }
        await pipeline.exec()
    } catch (error) {
        logUnavailable("record", error)
    }
}
