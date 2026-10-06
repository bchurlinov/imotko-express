import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { getInbox, getThread, getUnreadConversationCount } from "./chat_inbox.service.js"
import { markRead, reportConversation, sendMessage, toggleBlock } from "./conversation.service.js"
import { removeConversation } from "./chat_removal.service.js"

const originals = {
    conversationFindUnique: prisma.conversation.findUnique,
    participantFindMany: prisma.conversationParticipant.findMany,
    participantCount: prisma.conversationParticipant.count,
    participantUpdate: prisma.conversationParticipant.update,
    userFindUnique: prisma.user.findUnique,
    transaction: prisma.$transaction,
}

afterEach(() => {
    prisma.conversation.findUnique = originals.conversationFindUnique
    prisma.conversationParticipant.findMany = originals.participantFindMany
    prisma.conversationParticipant.count = originals.participantCount
    prisma.conversationParticipant.update = originals.participantUpdate
    prisma.user.findUnique = originals.userFindUnique
    prisma.$transaction = originals.transaction
})

const client = { type: "client", userId: "u1" }
const privateThread = {
    id: "c1",
    kind: "PRIVATE_INQUIRY",
    closedAt: null,
    lastDeliveredAt: new Date(),
    dedupeKey: "PRIVATE_INQUIRY:u:u1:s:u9:p:p1",
    propertyId: "p1",
    propertySnapshot: null,
    property: null,
    messages: [],
    participants: [
        {
            id: "pb",
            userId: "u1",
            agencyId: null,
            isSeller: false,
            removed: false,
            blockedAt: null,
            displayName: "Ана М.",
        },
        {
            id: "ps",
            userId: "u9",
            agencyId: null,
            isSeller: true,
            removed: false,
            blockedAt: null,
            displayName: "Марко П.",
        },
    ],
}

const failIfWritten = async () => {
    throw new Error("must not write")
}

// Review Focus 1
test("every by-id route answers 404 for a buyer–seller thread and writes nothing", async () => {
    prisma.conversation.findUnique = async () => privateThread
    prisma.conversationParticipant.update = failIfWritten
    prisma.$transaction = failIfWritten
    prisma.user.findUnique = async () => ({
        id: "u1",
        role: "CLIENT",
        emailVerified: new Date(),
        messagingFlagged: false,
    })

    assert.equal(await getThread(client, "c1"), null)
    for (const action of [
        () => sendMessage({ conversationId: "c1", viewer: client, bodyHtml: "<p>Hi</p>" }),
        () => markRead({ conversationId: "c1", viewer: client }),
        () => toggleBlock({ conversationId: "c1", viewer: client }),
        () => reportConversation({ conversationId: "c1", viewer: client, reason: "spam" }),
    ]) {
        await assert.rejects(action, { status: 404 })
    }
})

test("removal of a hidden thread answers 404 for legacy callers", async () => {
    prisma.$transaction = async fn =>
        fn({
            conversation: { updateMany: async () => ({ count: 1 }), findUnique: async () => privateThread },
        })
    await assert.rejects(() => removeConversation({ conversationId: "c1", viewer: client }), { status: 404 })
})

test("callers with clientListings can open the thread", async () => {
    prisma.conversation.findUnique = async () => privateThread
    const thread = await getThread(client, "c1", "mk", { shortTermRent: true, clientListings: true })
    assert.equal(thread.id, "c1")
})

// Review Focus 2
test("inbox and unread count query only agency threads for legacy callers", async () => {
    let inboxWhere
    let countWhere
    prisma.conversationParticipant.findMany = async ({ where }) => {
        inboxWhere = where
        return []
    }
    prisma.conversationParticipant.count = async ({ where }) => {
        countWhere = where
        return 0
    }
    await getInbox(client, { search: "Марко" })
    await getUnreadConversationCount(client)
    assert.deepEqual(inboxWhere.conversation.kind, { in: ["AGENCY_INQUIRY"] })
    assert.deepEqual(countWhere.conversation.kind, { in: ["AGENCY_INQUIRY"] })
})
