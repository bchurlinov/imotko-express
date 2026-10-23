import assert from "node:assert/strict"
import test from "node:test"
import { SignJWT, exportJWK, generateKeyPair } from "jose"

// supabase.js reads these at import time; set them before the dynamic import so the spec needs no .env
const SUPABASE_URL = "https://supabase.test"
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
const JWT_SECRET = "test-supabase-jwt-secret-at-least-32-bytes"
Object.assign(process.env, {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_JWT_SECRET: JWT_SECRET,
    SUPABASE_JWKS_URL: JWKS_URL,
})

const KID = "signing-key-1"
const signingKey = await generateKeyPair("ES256")
const strangerKey = await generateKeyPair("ES256")
const publicJwk = { ...(await exportJWK(signingKey.publicKey)), kid: KID, alg: "ES256", use: "sig" }

// Serve the JWKS that jose's createRemoteJWKSet fetches
globalThis.fetch = async url => {
    assert.equal(String(url), JWKS_URL)
    return new Response(JSON.stringify({ keys: [publicJwk] }), { headers: { "content-type": "application/json" } })
}

const { verifySupabaseJwt } = await import("./supabaseJwt.js")

const claims = () => new SignJWT({ role: "authenticated" }).setSubject("user-1").setExpirationTime("5m")

test("an ES256 token signed by a Supabase signing key verifies through the JWKS", async () => {
    const token = await claims()
        .setProtectedHeader({ alg: "ES256", kid: KID })
        .setIssuer(`${SUPABASE_URL}/auth/v1`)
        .sign(signingKey.privateKey)

    const payload = await verifySupabaseJwt(token)
    assert.equal(payload.sub, "user-1")
})

test("an ES256 token signed by a key outside the JWKS is rejected", async () => {
    const token = await claims()
        .setProtectedHeader({ alg: "ES256", kid: KID })
        .setIssuer(`${SUPABASE_URL}/auth/v1`)
        .sign(strangerKey.privateKey)

    await assert.rejects(verifySupabaseJwt(token))
})

test("an ES256 token from another issuer is rejected", async () => {
    const token = await claims()
        .setProtectedHeader({ alg: "ES256", kid: KID })
        .setIssuer("https://other.supabase.co/auth/v1")
        .sign(signingKey.privateKey)

    await assert.rejects(verifySupabaseJwt(token))
})

test("a legacy HS256 token still verifies while SUPABASE_JWT_SECRET is set", async () => {
    const token = await claims()
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(`${SUPABASE_URL}/auth/v1`)
        .sign(new TextEncoder().encode(JWT_SECRET))

    const payload = await verifySupabaseJwt(token)
    assert.equal(payload.sub, "user-1")
})
