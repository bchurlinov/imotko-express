import { assertRedisUrl } from "../facebook-property-publication/redis_url.js"

const requiredString = (env, key) => {
    const value = env[key]
    if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`)
    return value.trim()
}

/**
 * The bulk email worker only needs Redis and SES: recipients and opt-out links are resolved by the API when the
 * campaign is queued, so there is no database connection here.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadBulkEmailWorkerConfig(env = process.env) {
    return {
        redisUrl: assertRedisUrl(requiredString(env, "UPSTASH_REDIS_URL")),
        ses: {
            region: requiredString(env, "AWS_SES_REGION"),
            credentials: {
                accessKeyId: requiredString(env, "AWS_SES_KEY"),
                secretAccessKey: requiredString(env, "AWS_SES_SECRET_KEY"),
            },
        },
        from: `Imotko <${requiredString(env, "IMOTKO_EMAIL")}>`,
    }
}
