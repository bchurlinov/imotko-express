import assert from "node:assert/strict"
import test from "node:test"
import { MessageStatus } from "#generated/prisma/enums.ts"
import {
    buildDedupeKey,
    inboxParticipantWhere,
    removalEventFor,
    removalParticipantData,
    userLanguageToLocale,
    visibleMessageWhere,
} from "./chat_policy.js"

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

test("inbox scope carries the visible kinds for both sides", () => {
    assert.deepEqual(inboxParticipantWhere({ type: "client", userId: "u1" }), {
        userId: "u1",
        removed: false,
        conversation: { kind: { in: ["AGENCY_INQUIRY"] } },
    })
    assert.deepEqual(inboxParticipantWhere({ type: "agency", agencyId: "a1" }), {
        agencyId: "a1",
        removed: false,
        conversation: { lastDeliveredAt: { not: null }, kind: { in: ["AGENCY_INQUIRY"] } },
    })
})

test("client inbox search can merge its OR into the scope's conversation filter", () => {
    const scope = inboxParticipantWhere({ type: "client", userId: "u1" })
    const where = { ...scope, conversation: { ...scope.conversation, OR: [{ id: "x" }] } }
    assert.deepEqual(where, {
        userId: "u1",
        removed: false,
        conversation: { kind: { in: ["AGENCY_INQUIRY"] }, OR: [{ id: "x" }] },
    })
})

test("removal marks the side removed, locks it, and clears its counters", () => {
    const now = new Date(Date.UTC(2026, 9, 4, 12, 0))
    assert.deepEqual(removalParticipantData({ blockedAt: null }, now), {
        removed: true,
        blockedAt: now,
        unreadCount: 0,
        firstUnreadAt: null,
        reminderCount: 0,
    })
})

test("removal keeps an earlier block time", () => {
    const earlier = new Date(Date.UTC(2026, 8, 20))
    const now = new Date(Date.UTC(2026, 9, 4, 12, 0))
    assert.equal(removalParticipantData({ blockedAt: earlier }, now).blockedAt, earlier)
})

test("the seller side of a buyer–seller thread has its own removal marker", () => {
    assert.equal(removalEventFor("client", { isSeller: true }), "sellerRemovedConversation")
    assert.equal(removalEventFor("client", { isSeller: false }), "clientRemovedConversation")
    assert.equal(removalEventFor("client"), "clientRemovedConversation")
    assert.equal(removalEventFor("agency"), "agencyRemovedConversation")
})
