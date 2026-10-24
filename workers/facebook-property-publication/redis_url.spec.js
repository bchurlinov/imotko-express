import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { assertRedisUrl, isInternalRedisHost, redisTlsOptions } from "./redis_url.js"

describe("isInternalRedisHost", () => {
    for (const host of ["imotko-redis", "redis", "localhost", "127.0.0.1", "10.0.1.5", "172.18.0.4", "192.168.1.2", "[::1]"]) {
        test(`treats ${host} as internal`, () => assert.equal(isInternalRedisHost(host), true))
    }

    for (const host of ["redis.imotko.mk", "example.upstash.io", "187.126.8.199", "172.32.0.1", "", "[2a02:4780::1]"]) {
        test(`treats ${host || "an empty host"} as public`, () => assert.equal(isInternalRedisHost(host), false))
    }
})

describe("assertRedisUrl", () => {
    test("accepts rediss:// to any host", () => {
        const url = "rediss://default:secret@example.upstash.io:6379"
        assert.equal(assertRedisUrl(url), url)
    })

    test("accepts redis:// to an internal host", () => {
        const url = "redis://default:secret@imotko-redis:6379"
        assert.equal(assertRedisUrl(url), url)
    })

    test("rejects redis:// to a public host", () => {
        assert.throws(() => assertRedisUrl("redis://default:secret@187.126.8.199:6379"), /UPSTASH_REDIS_URL/)
    })

    test("rejects other protocols and malformed URLs", () => {
        assert.throws(() => assertRedisUrl("http://imotko-redis:6379"), /UPSTASH_REDIS_URL/)
        assert.throws(() => assertRedisUrl("not a url"), /valid Redis URL/)
    })
})

describe("redisTlsOptions", () => {
    test("enables TLS only for rediss://", () => {
        assert.deepEqual(redisTlsOptions("rediss://default:secret@example.upstash.io:6379"), {})
        assert.equal(redisTlsOptions("redis://default:secret@imotko-redis:6379"), undefined)
    })
})
