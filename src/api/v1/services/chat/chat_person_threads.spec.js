import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { getInbox, shapeThread } from "./chat_inbox.service.js"

const CAPABLE = { shortTermRent: true, clientListings: true }
const originals = { participantFindMany: prisma.conversationParticipant.findMany }
afterEach(() => {
    prisma.conversationParticipant.findMany = originals.participantFindMany
})

const person = (id, userId, displayName, extra = {}) => ({
    id,
    userId,
    agencyId: null,
    isSeller: false,
    displayName,
    blockedAt: null,
    deletedAt: null,
    removed: false,
    unreadCount: 0,
    lastReadAt: null,
    user: {
        phone: "070111222",
        email: `${userId}@x.mk`,
        createdAt: new Date(),
        emailVerified: new Date(),
        messagingFlagged: false,
    },
    agency: null,
    lastReadByMember: null,
    ...extra,
})
const agencyParticipant = {
    id: "pa",
    userId: null,
    agencyId: "a1",
    isSeller: false,
    displayName: "Агенција Дом",
    blockedAt: null,
    deletedAt: null,
    removed: false,
    unreadCount: 0,
    lastReadAt: null,
    user: null,
    agency: { status: "APPROVED", logo: null },
    lastReadByMember: null,
}
const thread = (kind, participants) => ({
    id: "c1",
    kind,
    propertyId: null,
    closedAt: null,
    lastDeliveredAt: new Date(),
    propertySnapshot: null,
    property: null,
    participants,
    messages: [],
})
const buyer = { type: "client", userId: "u1" }
const seller = { type: "client", userId: "u9" }
const privateThread = () =>
    thread("PRIVATE_INQUIRY", [person("pb", "u1", "Ана М."), person("ps", "u9", "Марко П.", { isSeller: true })])

test("in a buyer–seller thread each side sees the other person and can reply", () => {
    const forBuyer = shapeThread({ conversation: privateThread(), viewer: buyer, locale: "mk", capabilities: CAPABLE })
    assert.equal(forBuyer.counterpart.name, "Марко П.")
    assert.equal(forBuyer.counterpart.phone, null)
    assert.equal(forBuyer.canReply, true)
    assert.equal(forBuyer.counterpartType, "seller")
    assert.equal(forBuyer.sellerName, "Марко П.")

    const forSeller = shapeThread({
        conversation: privateThread(),
        viewer: seller,
        locale: "mk",
        capabilities: CAPABLE,
    })
    assert.equal(forSeller.counterpart.name, "Ана М.")
    assert.equal(forSeller.canReply, true)
    assert.equal(forSeller.counterpartType, "buyer")
})

test("the seller of an outreach thread sees the agency, labelled as outreach", () => {
    const outreach = thread("AGENCY_OUTREACH", [person("ps", "u9", "Марко П.", { isSeller: true }), agencyParticipant])
    const shaped = shapeThread({ conversation: outreach, viewer: seller, locale: "mk", capabilities: CAPABLE })
    assert.equal(shaped.counterpart.name, "Агенција Дом")
    assert.equal(shaped.counterpartType, "agency_outreach")
    assert.equal(shaped.canReply, true)
})

test("an agency never gets an outreach seller's phone or email", () => {
    const outreach = thread("AGENCY_OUTREACH", [person("ps", "u9", "Марко П.", { isSeller: true }), agencyParticipant])
    const shaped = shapeThread({
        conversation: outreach,
        viewer: { type: "agency", userId: "ua", agencyId: "a1", memberId: "m1", role: "owner" },
        locale: "mk",
        capabilities: CAPABLE,
    })
    assert.equal(shaped.counterpart.phone, null)
    assert.equal(shaped.counterpart.email, null)
})

test("an agency thread for app 1.0.5 keeps today's shape", () => {
    const agencyThread = thread("AGENCY_INQUIRY", [person("pc", "u1", "Ана Митевска"), agencyParticipant])
    const shaped = shapeThread({
        conversation: agencyThread,
        viewer: buyer,
        locale: "mk",
        capabilities: LEGACY_CAPABILITIES,
    })
    assert.equal(shaped.counterpart.name, "Агенција Дом")
    assert.equal(shaped.canReply, true)
    assert.equal(shaped.blockedBy, null)
    assert.equal("counterpartType" in shaped, false)
    assert.equal("sellerName" in shaped, false)
})

test("inbox: labels only for 1.1.0, and search matches other people as well as agencies", async () => {
    let where
    prisma.conversationParticipant.findMany = async query => {
        where = query.where
        return [
            {
                id: "pb",
                isSeller: false,
                agencyId: null,
                unreadCount: 1,
                conversation: {
                    id: "c1",
                    kind: "PRIVATE_INQUIRY",
                    propertyId: null,
                    createdAt: new Date(),
                    closedAt: null,
                    propertySnapshot: null,
                    participants: [
                        {
                            id: "pb",
                            userId: "u1",
                            agencyId: null,
                            isSeller: false,
                            displayName: "Ана М.",
                            agency: null,
                        },
                        {
                            id: "ps",
                            userId: "u9",
                            agencyId: null,
                            isSeller: true,
                            displayName: "Марко П.",
                            agency: null,
                        },
                    ],
                    messages: [],
                },
            },
        ]
    }
    const capable = await getInbox(buyer, { search: "Марко", capabilities: CAPABLE })
    assert.equal(capable.items[0].counterpartType, "seller")
    assert.equal(capable.items[0].counterpartName, "Марко П.")
    assert.deepEqual(where.conversation.OR[0].participants.some.OR, [{ userId: null }, { userId: { not: "u1" } }])

    const legacy = await getInbox(buyer, { capabilities: LEGACY_CAPABILITIES })
    assert.equal("counterpartType" in legacy.items[0], false)
})
