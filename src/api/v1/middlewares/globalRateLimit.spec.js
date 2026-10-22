import assert from "node:assert/strict"
import test from "node:test"
import express from "express"
import { SignJWT } from "jose"

// supabase.js reads these at import time; set them before the dynamic import so the spec needs no .env
const SUPABASE_URL = "https://supabase.test"
const JWT_SECRET = "test-supabase-jwt-secret-at-least-32-bytes"
Object.assign(process.env, {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_JWT_SECRET: JWT_SECRET,
    SUPABASE_JWKS_URL: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
})

const { INTERNAL_SECRET_HEADER, attachRateLimitKey } = await import("./rateLimitKey.js")
const { createGlobalRateLimiter, isGlobalRateLimitEnabled } = await import("./globalRateLimit.js")

const SECRET = "b".repeat(64)

// Same middleware order as app.js; limits shrunk to 2 / 3 so a handful of requests reaches them. Memory store only.
const startApp = async (t, env) => {
    process.env.INTERNAL_API_SECRET = SECRET
    const app = express()
    app.use(attachRateLimitKey)
    app.use(createGlobalRateLimiter({ env, anonymousLimit: 2, authenticatedLimit: 3 }))
    app.get("/ok", (req, res) => res.json({ ok: true }))
    const server = await new Promise(resolve => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening))
    })
    t.after(() => {
        delete process.env.INTERNAL_API_SECRET
        return new Promise(resolve => server.close(resolve))
    })
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    return (headers = {}) => fetch(`${baseUrl}/ok`, { headers })
}

const statuses = async (get, count, headers) => {
    const result = []
    for (let i = 0; i < count; i++) result.push((await get(headers)).status)
    return result
}

const signToken = sub =>
    new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(sub)
        .setIssuer(`${SUPABASE_URL}/auth/v1`)
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode(JWT_SECRET))

test("the global limiter is only enabled by RATE_LIMIT_ENABLED=true, never by ENV", () => {
    assert.equal(isGlobalRateLimitEnabled({ RATE_LIMIT_ENABLED: "true" }), true)
    for (const env of [{}, { ENV: "production" }, { RATE_LIMIT_ENABLED: "1" }, { RATE_LIMIT_ENABLED: "TRUE" }]) {
        assert.equal(isGlobalRateLimitEnabled(env), false, JSON.stringify(env))
    }
})

test("disabled: no limit, no RateLimit headers, and no store is created", async t => {
    let storeCreated = false
    const limiter = createGlobalRateLimiter({ env: { ENV: "production" }, createStore: () => (storeCreated = true) })
    assert.equal(storeCreated, false)
    assert.equal(typeof limiter, "function")

    const get = await startApp(t, {})
    assert.deepEqual(await statuses(get, 4), [200, 200, 200, 200])
    assert.equal((await get()).headers.get("ratelimit"), null)
})

test("enabled: anonymous requests are limited per IP and get draft-7 headers", async t => {
    const get = await startApp(t, { RATE_LIMIT_ENABLED: "true" })
    const first = await get()
    assert.equal(first.status, 200)
    assert.match(first.headers.get("ratelimit") ?? "", /limit=2/)
    assert.deepEqual(await statuses(get, 2), [200, 429])
    assert.equal((await get()).status, 429)
})

test("enabled: requests with the internal secret are never limited", async t => {
    const get = await startApp(t, { RATE_LIMIT_ENABLED: "true" })
    const internal = { [INTERNAL_SECRET_HEADER]: SECRET }
    assert.deepEqual(await statuses(get, 6, internal), [200, 200, 200, 200, 200, 200])
    // skipped requests carry no RateLimit header, which is how the rollout check tells the secret was accepted
    assert.equal((await get(internal)).headers.get("ratelimit"), null)
    // and they do not spend the IP bucket that visitors from the same address share
    assert.deepEqual(await statuses(get, 3), [200, 200, 429])
})

test("enabled: a wrong internal secret is limited like any anonymous caller", async t => {
    const get = await startApp(t, { RATE_LIMIT_ENABLED: "true" })
    assert.deepEqual(await statuses(get, 3, { [INTERNAL_SECRET_HEADER]: "c".repeat(64) }), [200, 200, 429])
})

test("enabled: signed-in users get their own, larger bucket", async t => {
    const get = await startApp(t, { RATE_LIMIT_ENABLED: "true" })
    const auth = { authorization: `Bearer ${await signToken("user-1")}` }
    assert.deepEqual(await statuses(get, 4, auth), [200, 200, 200, 429])
    // the user's requests did not use up the anonymous IP bucket
    assert.deepEqual(await statuses(get, 3), [200, 200, 429])
})
