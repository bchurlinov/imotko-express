import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { loadFacebookWorkerConfig } from "./config.js"

const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/imotko",
    UPSTASH_REDIS_URL: "rediss://default:secret@example.upstash.io:6379",
    META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    META_GRAPH_API_VERSION: "v24.0",
    PUBLIC_APP_URL: "https://imotko.mk/",
}

describe("loadFacebookWorkerConfig", () => {
    test("normalizes valid worker configuration", () => {
        assert.deepEqual(loadFacebookWorkerConfig(validEnv), {
            redisUrl: validEnv.UPSTASH_REDIS_URL,
            graphApiVersion: "v24.0",
            publicAppUrl: "https://imotko.mk",
            tokenEncryptionKey: validEnv.META_TOKEN_ENCRYPTION_KEY,
            requestTimeoutMs: 30000,
        })
    })

    for (const key of [
        "DATABASE_URL",
        "UPSTASH_REDIS_URL",
        "META_TOKEN_ENCRYPTION_KEY",
        "META_GRAPH_API_VERSION",
        "PUBLIC_APP_URL",
    ]) {
        test(`rejects missing ${key}`, () => {
            assert.throws(() => loadFacebookWorkerConfig({ ...validEnv, [key]: "" }), new RegExp(key))
        })
    }

    test("rejects a non-TLS Redis URL", () => {
        assert.throws(
            () => loadFacebookWorkerConfig({ ...validEnv, UPSTASH_REDIS_URL: "redis://localhost:6379" }),
            /UPSTASH_REDIS_URL/
        )
    })

    test("rejects a malformed Graph API version", () => {
        assert.throws(() => loadFacebookWorkerConfig({ ...validEnv, META_GRAPH_API_VERSION: "latest" }), /version/)
    })

    test("rejects a key that is not 32 decoded bytes", () => {
        assert.throws(
            () =>
                loadFacebookWorkerConfig({
                    ...validEnv,
                    META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(31, 7).toString("base64"),
                }),
            /32 bytes/
        )
    })

    test("rejects a token key with invalid Base64 characters", () => {
        assert.throws(
            () =>
                loadFacebookWorkerConfig({
                    ...validEnv,
                    META_TOKEN_ENCRYPTION_KEY: `${validEnv.META_TOKEN_ENCRYPTION_KEY}*`,
                }),
            /standard Base64/
        )
    })

    test("rejects a token key with invalid Base64 padding", () => {
        assert.throws(
            () =>
                loadFacebookWorkerConfig({
                    ...validEnv,
                    META_TOKEN_ENCRYPTION_KEY: validEnv.META_TOKEN_ENCRYPTION_KEY.slice(0, -1),
                }),
            /standard Base64/
        )
    })

    test("rejects a noncanonical but decodable token key", () => {
        assert.throws(
            () =>
                loadFacebookWorkerConfig({
                    ...validEnv,
                    META_TOKEN_ENCRYPTION_KEY: `${validEnv.META_TOKEN_ENCRYPTION_KEY.slice(0, -2)}d=`,
                }),
            /standard Base64/
        )
    })

    test("rejects a non-HTTPS public app origin", () => {
        assert.throws(
            () => loadFacebookWorkerConfig({ ...validEnv, PUBLIC_APP_URL: "http://imotko.mk" }),
            /PUBLIC_APP_URL/
        )
    })
})
