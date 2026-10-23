import assert from "node:assert/strict"
import test from "node:test"
import { SignJWT } from "jose"

// Production after the legacy secret was revoked: SUPABASE_JWT_SECRET is unset, so HS256 must be refused
const SUPABASE_URL = "https://supabase.test"
Object.assign(process.env, {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_JWKS_URL: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    // Empty, not deleted: dotenv/config never overrides a key that exists, so a local .env cannot fill it back in
    SUPABASE_JWT_SECRET: "",
})

const { verifySupabaseJwt } = await import("./supabaseJwt.js")

test("HS256 tokens are rejected when SUPABASE_JWT_SECRET is unset", async () => {
    const token = await new SignJWT({ role: "authenticated" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuer(`${SUPABASE_URL}/auth/v1`)
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode("any-secret-an-attacker-might-hold-123"))

    await assert.rejects(verifySupabaseJwt(token), /SUPABASE_JWT_SECRET is not set/)
})
