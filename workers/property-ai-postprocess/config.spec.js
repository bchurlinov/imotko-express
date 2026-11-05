import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { loadPropertyAiWorkerConfig } from "./config.js"

const validEnv = () => ({
    DATABASE_URL: "postgresql://localhost/imotko",
    UPSTASH_REDIS_URL: "rediss://default:secret@redis.example.com:6379",
    OPENAI_API_KEY: "sk-test",
    INTERNAL_API_SECRET: "internal-secret",
    IMOTKO_WEB_URL: "https://imotko.mk",
    REVALIDATE_SECRET: "revalidate-secret",
})

describe("loadPropertyAiWorkerConfig", () => {
    test("returns the redis url, web origin and internal secret", () => {
        assert.deepEqual(loadPropertyAiWorkerConfig(validEnv()), {
            redisUrl: "rediss://default:secret@redis.example.com:6379",
            webUrl: "https://imotko.mk",
            internalSecret: "internal-secret",
        })
    })

    for (const key of Object.keys(validEnv())) {
        test(`throws naming ${key} when it is missing or blank`, () => {
            for (const value of [undefined, "", "   "]) {
                const env = { ...validEnv(), [key]: value }
                assert.throws(() => loadPropertyAiWorkerConfig(env), new RegExp(`${key} is required`))
            }
        })
    }

    test("trims the secrets and strips a trailing slash from the web url", () => {
        const config = loadPropertyAiWorkerConfig({
            ...validEnv(),
            IMOTKO_WEB_URL: " https://imotko.mk/ ",
            INTERNAL_API_SECRET: " internal-secret ",
        })
        assert.equal(config.webUrl, "https://imotko.mk")
        assert.equal(config.internalSecret, "internal-secret")
    })

    test("accepts plain redis:// only to an internal host", () => {
        const internal = { ...validEnv(), UPSTASH_REDIS_URL: "redis://:pw@imotko-redis:6379" }
        assert.equal(loadPropertyAiWorkerConfig(internal).redisUrl, "redis://:pw@imotko-redis:6379")

        const external = { ...validEnv(), UPSTASH_REDIS_URL: "redis://:pw@redis.example.com:6379" }
        assert.throws(() => loadPropertyAiWorkerConfig(external), /UPSTASH_REDIS_URL must use rediss/)
    })

    test("rejects a web url that is not a valid https (or local http) address", () => {
        assert.throws(
            () => loadPropertyAiWorkerConfig({ ...validEnv(), IMOTKO_WEB_URL: "not a url" }),
            /IMOTKO_WEB_URL must be a valid URL/
        )
        assert.throws(
            () => loadPropertyAiWorkerConfig({ ...validEnv(), IMOTKO_WEB_URL: "http://imotko.mk" }),
            /IMOTKO_WEB_URL must use https/
        )
        assert.equal(
            loadPropertyAiWorkerConfig({ ...validEnv(), IMOTKO_WEB_URL: "http://localhost:3000" }).webUrl,
            "http://localhost:3000"
        )
    })
})
