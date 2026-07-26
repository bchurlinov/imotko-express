const requiredString = (env, key) => {
    const value = env[key]
    if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`)
    return value.trim()
}

export function loadFacebookWorkerConfig(env = process.env) {
    requiredString(env, "DATABASE_URL")

    const redisUrl = requiredString(env, "UPSTASH_REDIS_URL")
    const parsedRedisUrl = new URL(redisUrl)
    if (parsedRedisUrl.protocol !== "rediss:") throw new Error("UPSTASH_REDIS_URL must use rediss://")

    const tokenEncryptionKey = requiredString(env, "META_TOKEN_ENCRYPTION_KEY")
    const decodedTokenEncryptionKey = Buffer.from(tokenEncryptionKey, "base64")
    const isCanonicalBase64 =
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(tokenEncryptionKey) &&
        decodedTokenEncryptionKey.toString("base64") === tokenEncryptionKey
    if (!isCanonicalBase64) throw new Error("META_TOKEN_ENCRYPTION_KEY must be standard Base64")

    if (decodedTokenEncryptionKey.length !== 32) {
        throw new Error("META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes")
    }

    const graphApiVersion = requiredString(env, "META_GRAPH_API_VERSION")
    if (!/^v\d+\.\d+$/.test(graphApiVersion)) {
        throw new Error("META_GRAPH_API_VERSION must be a version like v24.0")
    }

    const publicAppUrl = new URL(requiredString(env, "PUBLIC_APP_URL"))
    if (publicAppUrl.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use https://")

    return {
        redisUrl,
        graphApiVersion,
        publicAppUrl: publicAppUrl.origin,
        tokenEncryptionKey,
        requestTimeoutMs: 30000,
    }
}
