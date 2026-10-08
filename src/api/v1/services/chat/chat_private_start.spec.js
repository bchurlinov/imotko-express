import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { findPrivateInquiryId, startPrivateInquiry } from "./conversation.service.js"
import { lookupConversationController, startConversationController } from "#controllers/chat/chat.controller.js"

const CAPABLE = { shortTermRent: true, clientListings: true }
const originals = {
    userFindUnique: prisma.user.findUnique,
    propertyFindFirst: prisma.property.findFirst,
    propertyFindUnique: prisma.property.findUnique,
    conversationFindUnique: prisma.conversation.findUnique,
    participantCount: prisma.conversationParticipant.count,
    messageFindMany: prisma.message.findMany,
    transaction: prisma.$transaction,
}
afterEach(() => {
    prisma.message.findMany = originals.messageFindMany
    prisma.user.findUnique = originals.userFindUnique
    prisma.property.findFirst = originals.propertyFindFirst
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.conversation.findUnique = originals.conversationFindUnique
    prisma.conversationParticipant.count = originals.participantCount
    prisma.$transaction = originals.transaction
})

const buyer = {
    id: "u1",
    role: "CLIENT",
    name: "Ана",
    lastName: "Митевска",
    emailVerified: null,
    messagingFlagged: false,
}
const listing = {
    id: "p1",
    name: { mk: "Стан" },
    slug: "stan",
    price: 98000,
    listingType: "for_sale",
    size: 64,
    attributes: {},
    photos: [],
    district: null,
    country: "macedonia",
    propertyLocation: { name: "ohrid" },
    client: { userId: "u9", user: { name: "Марко", lastName: "Петровски" } },
}

test("a buyer starts a held thread with a private seller (unverified sender)", async () => {
    let created
    let propertyWhere
    prisma.user.findUnique = async () => buyer
    prisma.property.findFirst = async ({ where }) => {
        propertyWhere = where
        return listing
    }
    prisma.conversation.findUnique = async () => null
    prisma.conversationParticipant.count = async () => 0
    prisma.message.findMany = async () => []
    const tx = {
        conversation: {
            create: async ({ data }) => {
                created = data
                return {
                    id: "c1",
                    participants: [
                        { id: "pb", userId: "u1" },
                        { id: "ps", userId: "u9" },
                    ],
                }
            },
        },
        message: { create: async () => ({ id: "m1" }) },
    }
    prisma.$transaction = async fn => fn(tx)

    const result = await startPrivateInquiry({
        buyerUserId: "u1",
        propertyId: "p1",
        bodyHtml: "<p>Достапен?</p>",
        capabilities: CAPABLE,
    })
    assert.deepEqual(result, { conversationId: "c1", messageId: "m1", created: true })
    assert.equal(created.kind, "PRIVATE_INQUIRY")
    assert.equal(created.dedupeKey, "PRIVATE_INQUIRY:u:u1:s:u9:p:p1")
    assert.deepEqual(
        created.participants.create.map(item => [item.userId, item.isSeller === true, item.displayName]),
        [
            ["u1", false, "Ана М."],
            ["u9", true, "Марко П."],
        ]
    )
    assert.deepEqual(propertyWhere.clientId, { not: null })
})

test("the seller cannot message their own listing", async () => {
    prisma.user.findUnique = async () => ({ ...buyer, id: "u9" })
    prisma.property.findFirst = async () => listing
    await assert.rejects(
        () =>
            startPrivateInquiry({ buyerUserId: "u9", propertyId: "p1", bodyHtml: "<p>Hi</p>", capabilities: CAPABLE }),
        { code: "cannotMessageOwnListing", status: 403 }
    )
})

test("an app without client listings cannot reach a private listing", async () => {
    prisma.user.findUnique = async () => buyer
    let where
    prisma.property.findFirst = async query => {
        where = query.where
        return null
    }
    await assert.rejects(
        () =>
            startPrivateInquiry({
                buyerUserId: "u1",
                propertyId: "p1",
                bodyHtml: "<p>Hi</p>",
                capabilities: LEGACY_CAPABILITIES,
            }),
        { code: "listingNotAvailable", status: 404 }
    )
    assert.ok(where.AND.some(condition => condition.clientId === null))
})

test("lookup finds the buyer's thread for a private listing", async () => {
    prisma.property.findUnique = async () => ({ client: { userId: "u9" } })
    prisma.conversation.findUnique = async ({ where }) =>
        where.dedupeKey === "PRIVATE_INQUIRY:u:u1:s:u9:p:p1" ? { id: "c7" } : null
    assert.equal(await findPrivateInquiryId({ userId: "u1", propertyId: "p1" }), "c7")
})

const fakeRes = () => ({
    statusCode: 0,
    body: null,
    status(code) {
        this.statusCode = code
        return this
    },
    json(body) {
        this.body = body
        return this
    },
})

test("app 1.0.5: a start without agencyId stays a validation error, and lookup without agencyId finds nothing", async () => {
    const req = {
        chatViewer: { type: "client", userId: "u1" },
        body: { propertyId: "p1", bodyHtml: "<p>Hi</p>" },
        query: { propertyId: "p1" },
        capabilities: LEGACY_CAPABILITIES,
    }
    await assert.rejects(() => startConversationController(req, fakeRes()), { code: "validationFailed", status: 400 })
    const res = fakeRes()
    await lookupConversationController(req, res)
    assert.deepEqual(res.body.data, { conversationId: null })
})
