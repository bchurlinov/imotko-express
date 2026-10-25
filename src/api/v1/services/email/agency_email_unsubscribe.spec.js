import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"
import { createAgencyEmailUnsubscribeToken } from "./agency_email_unsubscribe.js"

// The web app verifies these tokens (src/lib/email/agency_email_unsubscribe.js), so the format must match exactly
const webToken = (agencyId, secret) =>
    `${Buffer.from(agencyId).toString("base64url")}.${createHmac("sha256", secret)
        .update(`agency-email-unsubscribe:${agencyId}`)
        .digest()
        .toString("base64url")}`

describe("createAgencyEmailUnsubscribeToken", () => {
    it("builds the same token the web app builds with the shared secret", () => {
        assert.equal(createAgencyEmailUnsubscribeToken("agency-1", "shared"), webToken("agency-1", "shared"))
    })

    it("returns null without a secret or agency id", () => {
        assert.equal(createAgencyEmailUnsubscribeToken("agency-1", ""), null)
        assert.equal(createAgencyEmailUnsubscribeToken("", "shared"), null)
    })
})
