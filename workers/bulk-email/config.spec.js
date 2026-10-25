import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadBulkEmailWorkerConfig } from "./config.js"

const env = {
    UPSTASH_REDIS_URL: "redis://default:pw@imotko-redis:6379",
    AWS_SES_REGION: "eu-central-1",
    AWS_SES_KEY: "key",
    AWS_SES_SECRET_KEY: "secret",
    IMOTKO_EMAIL: "info@imotko.mk",
}

describe("loadBulkEmailWorkerConfig", () => {
    it("reads Redis, SES and the sender", () => {
        assert.deepEqual(loadBulkEmailWorkerConfig(env), {
            redisUrl: env.UPSTASH_REDIS_URL,
            ses: { region: "eu-central-1", credentials: { accessKeyId: "key", secretAccessKey: "secret" } },
            from: "Imotko <info@imotko.mk>",
        })
    })

    for (const key of Object.keys(env)) {
        it(`requires ${key}`, () => {
            assert.throws(() => loadBulkEmailWorkerConfig({ ...env, [key]: " " }), new RegExp(key))
        })
    }

    it("refuses plain redis:// to a public host", () => {
        assert.throws(
            () => loadBulkEmailWorkerConfig({ ...env, UPSTASH_REDIS_URL: "redis://default:pw@example.com:6379" }),
            /rediss:\/\//
        )
    })
})
