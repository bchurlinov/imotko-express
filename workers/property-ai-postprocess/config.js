import { assertRedisUrl } from "../facebook-property-publication/redis_url.js"

const LOCAL_HOSTS = ["localhost", "127.0.0.1"]

const requiredString = (env, key) => {
    const value = env[key]
    if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`)
    return value.trim()
}

// The internal secret is sent to this host, so it must be https (plain http only for local development)
const assertWebUrl = value => {
    let url
    try {
        url = new URL(value)
    } catch {
        throw new Error("IMOTKO_WEB_URL must be a valid URL")
    }
    const isLocal = url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname)
    if (url.protocol !== "https:" && !isLocal) throw new Error("IMOTKO_WEB_URL must use https://")
    return url.origin
}

/**
 * Environment for the property AI worker. DATABASE_URL and OPENAI_API_KEY are read by the database client and the
 * AI SDK; they are required here so a misconfigured container fails at start instead of on the first job.
 * REVALIDATE_SECRET is read by notifyTemplates.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ redisUrl: string, webUrl: string, internalSecret: string }}
 */
export function loadPropertyAiWorkerConfig(env = process.env) {
    requiredString(env, "DATABASE_URL")
    const redisUrl = assertRedisUrl(requiredString(env, "UPSTASH_REDIS_URL"))
    requiredString(env, "OPENAI_API_KEY")
    const internalSecret = requiredString(env, "INTERNAL_API_SECRET")
    const webUrl = assertWebUrl(requiredString(env, "IMOTKO_WEB_URL"))
    requiredString(env, "REVALIDATE_SECRET")

    return { redisUrl, webUrl, internalSecret }
}
