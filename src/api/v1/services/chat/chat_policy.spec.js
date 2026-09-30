import assert from "node:assert/strict"
import test from "node:test"
import { MessageStatus } from "#generated/prisma/enums.ts"
import { buildDedupeKey, userLanguageToLocale, visibleMessageWhere } from "./chat_policy.js"

test("dedupe keys are stable per agency inquiry", () => {
    assert.equal(
        buildDedupeKey({ kind: "AGENCY_INQUIRY", userId: "u", agencyId: "a", propertyId: null }),
        "AGENCY_INQUIRY:u:u:a:a:p:none"
    )
})

test("client visibility includes own held messages while agency visibility requires delivery", () => {
    assert.deepEqual(visibleMessageWhere({ viewerType: "agency", viewerUserId: "a" }), {
        status: MessageStatus.DELIVERED,
    })
    assert.deepEqual(visibleMessageWhere({ viewerType: "client", viewerUserId: "u" }), {
        OR: [{ status: MessageStatus.DELIVERED }, { senderUserId: "u" }],
    })
})

test("Turkish user language resolves to the Turkish chat locale", () => {
    assert.equal(userLanguageToLocale("TR"), "tr")
})
