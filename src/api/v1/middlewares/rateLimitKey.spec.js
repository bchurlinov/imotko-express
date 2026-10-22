import assert from "node:assert/strict"
import test from "node:test"
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

const { INTERNAL_SECRET_HEADER, attachRateLimitKey, isTrustedInternalCaller, normalizeIp, resolveRateLimitKey } =
    await import("./rateLimitKey.js")

const SECRET = "a".repeat(64)
const ENV = { INTERNAL_API_SECRET: SECRET }

const fakeReq = ({ headers = {}, ip = "203.0.113.7" } = {}) => ({ headers, ip })

const signToken = (sub, secret = JWT_SECRET) =>
    new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(sub)
        .setIssuer(`${SUPABASE_URL}/auth/v1`)
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode(secret))

test("the internal secret header is trusted only when it matches INTERNAL_API_SECRET", () => {
    assert.equal(isTrustedInternalCaller(fakeReq({ headers: { [INTERNAL_SECRET_HEADER]: SECRET } }), ENV), true)
})

test("missing, wrong, shorter or repeated internal secret headers are not trusted", () => {
    for (const value of [undefined, "", "wrong", SECRET.slice(1), `${SECRET}x`, [SECRET, SECRET]]) {
        const headers = value === undefined ? {} : { [INTERNAL_SECRET_HEADER]: value }
        assert.equal(isTrustedInternalCaller(fakeReq({ headers }), ENV), false, String(value))
    }
})

test("nobody is trusted while INTERNAL_API_SECRET is unset, even with an empty header", () => {
    for (const env of [{}, { INTERNAL_API_SECRET: "" }]) {
        assert.equal(isTrustedInternalCaller(fakeReq({ headers: { [INTERNAL_SECRET_HEADER]: "" } }), env), false)
        assert.equal(isTrustedInternalCaller(fakeReq({ headers: { [INTERNAL_SECRET_HEADER]: SECRET } }), env), false)
    }
})

test("anonymous requests are keyed by IP, with IPv6 collapsed to its /64", async () => {
    assert.deepEqual(await resolveRateLimitKey(fakeReq()), { key: "ip:203.0.113.7", kind: "ip" })
    assert.deepEqual(await resolveRateLimitKey(fakeReq({ ip: "::ffff:198.51.100.4" })), {
        key: "ip:198.51.100.4",
        kind: "ip",
    })
    assert.equal(normalizeIp("2001:db8:1:2:3:4:5:6"), "2001:db8:1:2::/64")
    assert.equal(normalizeIp("2001:db8::1"), "2001:db8:0:0::/64")
})

test("a verified Supabase token keys the request by user id", async () => {
    const token = await signToken("user-123")
    const key = await resolveRateLimitKey(fakeReq({ headers: { authorization: `Bearer ${token}` } }))
    assert.deepEqual(key, { key: "user:user-123", kind: "user" })
})

test("a token signed with another secret falls back to the IP bucket", async () => {
    const token = await signToken("forged-user", "some-other-secret-that-is-long-enough")
    const key = await resolveRateLimitKey(fakeReq({ headers: { authorization: `Bearer ${token}` } }))
    assert.deepEqual(key, { key: "ip:203.0.113.7", kind: "ip" })
})

test("attachRateLimitKey sets the bucket and the internal flag, then calls next", async t => {
    t.after(() => delete process.env.INTERNAL_API_SECRET)
    process.env.INTERNAL_API_SECRET = SECRET

    const internal = fakeReq({ headers: { [INTERNAL_SECRET_HEADER]: SECRET } })
    const visitor = fakeReq({ headers: { [INTERNAL_SECRET_HEADER]: "guess" } })
    let calls = 0
    const next = () => calls++

    await attachRateLimitKey(internal, {}, next)
    await attachRateLimitKey(visitor, {}, next)

    assert.equal(calls, 2)
    assert.equal(internal.trustedInternalCaller, true)
    assert.equal(visitor.trustedInternalCaller, false)
    assert.deepEqual(visitor.rateLimitKey, { key: "ip:203.0.113.7", kind: "ip" })
})
