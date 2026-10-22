/**
 * Server-level settings that differ between hosts (Railway vs the Dokploy VPS)
 * @module config/server
 */

/** Railway puts two proxies in front of the app, which is what production has always used */
export const DEFAULT_TRUST_PROXY_HOPS = 2

/**
 * Number of proxy hops Express trusts when resolving req.ip from X-Forwarded-For.
 * Railway: 2. Dokploy VPS (Traefik -> app): 1. An unset or invalid value keeps the Railway default.
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {number} Hop count for app.set("trust proxy", ...)
 */
export function resolveTrustProxyHops(env = process.env) {
    const raw = env.TRUST_PROXY_HOPS?.trim()
    if (!raw || !/^\d+$/.test(raw)) return DEFAULT_TRUST_PROXY_HOPS
    return Number(raw)
}

/**
 * The IP debug route echoes req.ip / X-Forwarded-For so a new host's proxy setup can be verified.
 * Off unless DEBUG_IP_ROUTE is exactly "true"; remove the flag once the check is done.
 * @param {NodeJS.ProcessEnv} [env] - Environment to read from
 * @returns {boolean} True when the route should be mounted
 */
export const isDebugIpRouteEnabled = (env = process.env) => env.DEBUG_IP_ROUTE === "true"
