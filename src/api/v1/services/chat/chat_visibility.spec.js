import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { isConversationKindVisible, visibleConversationKinds, withoutHiddenProperty } from "./chat_visibility.js"
import { assertAgencyAvailable } from "./conversation.service.js"
import { shapeThread } from "./chat_inbox.service.js"

const originals = {
    agencyFindUnique: prisma.agency.findUnique,
    propertyFindFirst: prisma.property.findFirst,
}

afterEach(() => {
    prisma.agency.findUnique = originals.agencyFindUnique
    prisma.property.findFirst = originals.propertyFindFirst
})

const shortTermConversation = {
    id: "conversation_1",
    kind: "AGENCY_INQUIRY",
    propertyId: "property_1",
    closedAt: null,
    property: { id: "property_1", listingType: "short_term_rent", status: "PUBLISHED", slug: "stan" },
    propertySnapshot: { name: { mk: "Стан" }, listingType: "short_term_rent", photo: null },
    participants: [],
    messages: [],
}

test("legacy callers get a short-term thread without its listing", () => {
    const stripped = withoutHiddenProperty(shortTermConversation)
    assert.equal(stripped.propertyId, null)
    assert.equal(stripped.property, null)
    assert.equal(stripped.propertySnapshot, null)
    assert.equal(stripped.id, "conversation_1")
})

test("snapshot-only rows (inbox) are stripped too", () => {
    const { property, ...inboxRow } = shortTermConversation
    assert.equal(withoutHiddenProperty(inboxRow).propertySnapshot, null)
})

test("other threads and capable callers are untouched", () => {
    assert.equal(withoutHiddenProperty(shortTermConversation, { shortTermRent: true }), shortTermConversation)
    const saleThread = { ...shortTermConversation, propertySnapshot: { listingType: "for_sale" }, property: null }
    assert.equal(withoutHiddenProperty(saleThread), saleThread)
    const noProperty = { ...shortTermConversation, propertyId: null, property: null, propertySnapshot: null }
    assert.equal(withoutHiddenProperty(noProperty), noProperty)
})

test("a stripped thread shapes like a plain agency conversation", () => {
    const thread = shapeThread({
        conversation: withoutHiddenProperty(shortTermConversation),
        viewer: { type: "client", userId: "user_1" },
        locale: "mk",
    })
    assert.equal(thread.property, null)
    assert.equal(thread.conversation.propertyId, null)
})

test("a legacy caller cannot start a chat about a short-term listing", async () => {
    let propertyWhere
    prisma.agency.findUnique = async () => ({ id: "agency_1", name: "Dom", status: "APPROVED" })
    prisma.property.findFirst = async query => {
        propertyWhere = query.where
        return null
    }

    await assert.rejects(() => assertAgencyAvailable({ agencyId: "agency_1", propertyId: "property_1" }), {
        status: 404,
    })
    assert.deepEqual(propertyWhere.AND, [{ listingType: { not: "short_term_rent" } }, { clientId: null }])

    prisma.property.findFirst = async query => {
        propertyWhere = query.where
        return { id: "property_1" }
    }
    await assertAgencyAvailable({
        agencyId: "agency_1",
        propertyId: "property_1",
        capabilities: { shortTermRent: true, clientListings: true },
    })
    assert.deepEqual(propertyWhere.AND, [])
})

test("legacy callers only see agency inquiries", () => {
    assert.deepEqual(visibleConversationKinds(), ["AGENCY_INQUIRY"])
    assert.equal(isConversationKindVisible("PRIVATE_INQUIRY"), false)
    assert.equal(isConversationKindVisible("AGENCY_OUTREACH"), false)
    assert.equal(isConversationKindVisible("AGENCY_INQUIRY"), true)
})

test("callers with clientListings see every kind", () => {
    assert.deepEqual(visibleConversationKinds({ clientListings: true }).sort(), [
        "AGENCY_INQUIRY",
        "AGENCY_OUTREACH",
        "PRIVATE_INQUIRY",
    ])
})
