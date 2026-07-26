import { resolveVerifiedUserId } from "#utils/auth/supabaseJwt.js"

/**
 * Collapses an IPv6 address to its /64 prefix.
 *
 * A single client is routinely handed a whole /64, so keying on the full
 * address would let one host rotate through 2^64 keys and bypass the limit
 * entirely. IPv4 addresses are returned unchanged.
 *
 * @param {string} ip - Remote address
 * @returns {string} Normalized rate limit key portion
 */
export const normalizeIp = ip => {
    if (!ip) return "unknown"

    // Express may report IPv4-mapped IPv6 (::ffff:1.2.3.4) - treat as IPv4
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
    if (mapped) return mapped[1]

    if (!ip.includes(":")) return ip

    const [address] = ip.split("%") // strip zone index (fe80::1%eth0)
    const expanded = expandIpv6(address)
    return expanded ? `${expanded.slice(0, 4).join(":")}::/64` : address
}

/**
 * Expands a compressed IPv6 address into its eight hextets
 * @param {string} address - IPv6 address
 * @returns {string[] | undefined} Eight hextets, or undefined when unparseable
 */
const expandIpv6 = address => {
    const halves = address.split("::")
    if (halves.length > 2) return undefined

    const head = halves[0] ? halves[0].split(":") : []
    const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : []

    if (halves.length === 1) return head.length === 8 ? head : undefined

    const gap = 8 - head.length - tail.length
    if (gap < 0) return undefined

    return [...head, ...Array(gap).fill("0"), ...tail]
}

/**
 * Resolves the rate limit bucket for a request.
 *
 * Authenticated requests are keyed by verified Supabase user id so that mobile
 * clients sharing a carrier NAT address do not consume each other's budget.
 * The token is fully verified (not just decoded) - a decoded-only key would let
 * an attacker forge a fresh `sub` per request and bypass the limiter.
 *
 * @param {import('express').Request} req - Express request object
 * @returns {Promise<{ key: string, kind: "user" | "ip" }>} Bucket descriptor
 */
export const resolveRateLimitKey = async req => {
    const userId = await resolveVerifiedUserId(req)
    if (userId) return { key: `user:${userId}`, kind: "user" }

    return { key: `ip:${normalizeIp(req.ip)}`, kind: "ip" }
}

/**
 * Attaches `req.rateLimitKey` before the limiter runs, so both `keyGenerator`
 * and `limit` read the same already-resolved value instead of verifying the
 * token twice.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const attachRateLimitKey = async (req, res, next) => {
    try {
        req.rateLimitKey = await resolveRateLimitKey(req)
    } catch {
        req.rateLimitKey = { key: `ip:${normalizeIp(req.ip)}`, kind: "ip" }
    }
    next()
}
