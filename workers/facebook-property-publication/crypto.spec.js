import assert from "node:assert/strict"
import { createCipheriv } from "node:crypto"
import { describe, test } from "node:test"
import { decryptMetaToken } from "./crypto.js"
import { MetaCryptoError } from "./errors.js"

const key = Buffer.alloc(32, 7)
const keyBase64 = key.toString("base64")

const envelopeFor = (plaintext, overrides = {}) => {
    const iv = Buffer.alloc(12, 3)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const envelope = {
        v: 1,
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        ...overrides,
    }
    return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url")
}

const mutateEnvelope = (encryptedToken, mutate) => {
    const envelope = JSON.parse(Buffer.from(encryptedToken, "base64url").toString("utf8"))
    return Buffer.from(JSON.stringify(mutate(envelope)), "utf8").toString("base64url")
}

describe("decryptMetaToken", () => {
    test("decrypts the Next.js version-1 envelope", () => {
        assert.equal(decryptMetaToken(envelopeFor("page-access-token"), keyBase64), "page-access-token")
    })

    test("rejects unsupported versions", () => {
        assert.throws(() => decryptMetaToken(envelopeFor("token", { v: 2 }), keyBase64), MetaCryptoError)
    })

    test("rejects invalid IV and tag lengths", () => {
        assert.throws(() => decryptMetaToken(envelopeFor("token", { iv: "AA" }), keyBase64), MetaCryptoError)
        assert.throws(() => decryptMetaToken(envelopeFor("token", { tag: "AA" }), keyBase64), MetaCryptoError)
    })

    test("rejects an outer envelope with illegal Base64URL characters without leaking it", () => {
        const invalidEnvelope = `${envelopeFor("outer-secret-token")}!`

        assert.throws(
            () => decryptMetaToken(invalidEnvelope, keyBase64),
            error => error instanceof MetaCryptoError && !error.message.includes(invalidEnvelope)
        )
    })

    test("rejects inner encrypted fields with illegal Base64URL characters without leaking them", () => {
        for (const field of ["iv", "tag", "ciphertext"]) {
            const validEnvelope = envelopeFor("page-access-token")
            const invalidEnvelope = mutateEnvelope(validEnvelope, envelope => ({
                ...envelope,
                [field]: `${envelope[field]}!`,
            }))

            assert.throws(
                () => decryptMetaToken(invalidEnvelope, keyBase64),
                error => error instanceof MetaCryptoError && !error.message.includes(invalidEnvelope)
            )
        }
    })

    test("rejects truthy non-string encryption keys with MetaCryptoError", () => {
        assert.throws(() => decryptMetaToken(envelopeFor("token"), 42), MetaCryptoError)
    })

    test("rejects wrong-length string encryption keys with MetaCryptoError", () => {
        assert.throws(() => decryptMetaToken(envelopeFor("token"), "too-short"), MetaCryptoError)
    })

    test("rejects tampered ciphertext without exposing inputs", () => {
        const encrypted = envelopeFor("secret-page-token", { ciphertext: "AA" })
        assert.throws(
            () => decryptMetaToken(encrypted, keyBase64),
            error => error instanceof MetaCryptoError && !error.message.includes("secret-page-token")
        )
    })
})
