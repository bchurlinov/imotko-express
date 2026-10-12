import assert from "node:assert/strict"
import test from "node:test"
import { chatEmailAllowed, chatEmailUnsubscribeLink } from "./chat_email_preferences.js"

const client = clientRow => ({ userId: "u1", user: { client: clientRow } })

test("a client who turned chat emails off gets none; agencies and missing rows are unaffected", () => {
    assert.equal(chatEmailAllowed(client({ chatEmailsEnabled: false })), false)
    assert.equal(chatEmailAllowed(client({ chatEmailsEnabled: true })), true)
    assert.equal(chatEmailAllowed(client(null)), true)
    assert.equal(chatEmailAllowed({ userId: null, agencyId: "a1" }), true)
})

test("links a client to the web opt-out page in their language; agencies get no link", () => {
    assert.equal(
        chatEmailUnsubscribeLink(client({ chatEmailsUnsubscribeToken: "tok-1" }), "https://imotko.mk", "en"),
        "https://imotko.mk/en/poraki/otkazi-izvestuvanja/tok-1"
    )
    assert.equal(chatEmailUnsubscribeLink(client(null), "https://imotko.mk", "mk"), "")
    assert.equal(chatEmailUnsubscribeLink({ userId: null, agencyId: "a1" }, "https://imotko.mk", "mk"), "")
})
