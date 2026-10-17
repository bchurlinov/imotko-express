import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import prisma from "#database/client.js"
import { chatEffects } from "./chat_effects.js"
import { approveMessage } from "./chat_admin.service.js"
import { releasePendingForUser } from "./chat_lifecycle.service.js"
import { sendMessage, startPrivateInquiry } from "./conversation.service.js"

const CAPABLE = { shortTermRent: true, clientListings: true }
const originals = {
    userFindUnique: prisma.user.findUnique,
    propertyFindFirst: prisma.property.findFirst,
    conversationFindUnique: prisma.conversation.findUnique,
    participantCount: prisma.conversationParticipant.count,
    participantFindUnique: prisma.conversationParticipant.findUnique,
    messageFindUnique: prisma.message.findUnique,
    messageFindFirst: prisma.message.findFirst,
    messageFindMany: prisma.message.findMany,
    transaction: prisma.$transaction,
    firstContact: chatEffects.firstContact,
}
let tracked = []
beforeEach(() => {
    tracked = []
    chatEffects.firstContact = id => tracked.push(id)
    // The email and push queues start from these lookups; empty answers end them at once.
    prisma.conversationParticipant.findUnique = async () => null
    prisma.message.findUnique = async () => null
})
afterEach(() => {
    chatEffects.firstContact = originals.firstContact
    prisma.user.findUnique = originals.userFindUnique
    prisma.property.findFirst = originals.propertyFindFirst
    prisma.conversation.findUnique = originals.conversationFindUnique
    prisma.conversationParticipant.count = originals.participantCount
    prisma.conversationParticipant.findUnique = originals.participantFindUnique
    prisma.message.findUnique = originals.messageFindUnique
    prisma.message.findFirst = originals.messageFindFirst
    prisma.message.findMany = originals.messageFindMany
    prisma.$transaction = originals.transaction
})

const buyer = (emailVerified = new Date()) => ({
    id: "u1",
    role: "CLIENT",
    name: "Ана",
    lastName: "Митевска",
    email: "ana@x.mk",
    emailVerified,
    messagingFlagged: false,
    messagingUnflaggedAt: null,
})
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
const participants = [
    { id: "pb", userId: "u1", agencyId: null, isSeller: false, removed: false, blockedAt: null, displayName: "Ана М." },
    { id: "ps", userId: "u9", agencyId: null, isSeller: true, removed: false, blockedAt: null, displayName: "Марко П." },
]

// A transaction that supports the real deliverMessage for a delivered message in the thread above.
const deliveringTx = extra => ({
    conversation: {
        create: async () => ({
            id: "c1",
            participants: [
                { id: "pb", userId: "u1" },
                { id: "ps", userId: "u9" },
            ],
        }),
        update: async () => ({}),
    },
    message: {
        create: async () => ({ id: "m1" }),
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => ({ conversationId: "c1", senderParticipantId: "pb", conversation: { participants } }),
    },
    conversationParticipant: { update: async () => ({}), updateMany: async () => ({ count: 1 }) },
    // The recipient notification looks the recipient up; an unknown user ends it without writing.
    user: { findUnique: async () => null },
    ...extra,
})

const stubStart = emailVerified => {
    prisma.user.findUnique = async () => buyer(emailVerified)
    prisma.property.findFirst = async () => listing
    prisma.conversation.findUnique = async () => null
    prisma.conversationParticipant.count = async () => 0
    prisma.message.findMany = async () => []
    prisma.$transaction = async fn => fn(deliveringTx())
}

test("a delivered opening message is handed to first-contact tracking", async () => {
    stubStart(new Date())

    await startPrivateInquiry({ buyerUserId: "u1", propertyId: "p1", bodyHtml: "<p>Достапен?</p>", capabilities: CAPABLE })

    assert.deepEqual(tracked, ["m1"])
})

test("a held opening message is not handed over", async () => {
    stubStart(null)

    await startPrivateInquiry({ buyerUserId: "u1", propertyId: "p1", bodyHtml: "<p>Достапен?</p>", capabilities: CAPABLE })

    assert.deepEqual(tracked, [])
})

test("a delivered reply in an existing thread is handed over", async () => {
    prisma.user.findUnique = async () => buyer(new Date())
    prisma.conversation.findUnique = async () => ({
        id: "c1",
        kind: "PRIVATE_INQUIRY",
        closedAt: null,
        propertyId: "p1",
        participants,
        messages: [],
    })
    prisma.conversationParticipant.count = async () => 0
    prisma.message.findFirst = async () => null
    prisma.message.findMany = async () => []
    prisma.$transaction = async fn => fn(deliveringTx())

    await sendMessage({
        conversationId: "c1",
        viewer: { type: "client", userId: "u1" },
        bodyHtml: "<p>Уште една</p>",
        capabilities: CAPABLE,
    })

    assert.deepEqual(tracked, ["m1"])
})

test("releasing a verified sender's held messages hands over each delivered one", async () => {
    prisma.user.findUnique = async () => ({ messagingFlagged: false })
    prisma.message.findMany = async () => [{ id: "m1" }, { id: "m2" }]
    let call = 0
    prisma.$transaction = async fn =>
        fn(
            deliveringTx({
                message: {
                    updateMany: async () => ({ count: (call += 1) === 1 ? 1 : 0 }),
                    findUnique: async () => ({
                        conversationId: "c1",
                        senderParticipantId: "pb",
                        conversation: { participants },
                    }),
                },
            })
        )

    await releasePendingForUser("u1")

    assert.deepEqual(tracked, ["m1"])
})

test("admin approval of the first held message is handed over", async () => {
    prisma.$transaction = async fn =>
        fn(
            deliveringTx({
                message: {
                    updateMany: async () => ({ count: 1 }),
                    findUnique: async () => ({
                        status: "PENDING_REVIEW",
                        conversationId: "c1",
                        senderParticipantId: "pb",
                        conversation: { participants },
                    }),
                },
            })
        )

    await approveMessage({ messageId: "m1", adminId: "admin" })

    assert.deepEqual(tracked, ["m1"])
})
