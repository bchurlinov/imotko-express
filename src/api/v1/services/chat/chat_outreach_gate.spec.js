import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { withoutHiddenNotifications } from "#services/users/notification_visibility.js"
import { getInbox, getThread, getUnreadConversationCount } from "./chat_inbox.service.js"
import { sendChatPushNotification } from "./chat_push.service.js"
import { removeConversation } from "./chat_removal.service.js"
import { markRead, reportConversation, sendMessage, toggleBlock } from "./conversation.service.js"
import { isConversationKindVisible } from "./chat_visibility.js"

// Sub-project C (decision 135a): app 1.0.5 must never see an agency-outreach thread. B's allow-list does the work;
// this spec keeps it that way.

const originals = {
    conversationFindUnique: prisma.conversation.findUnique,
    participantFindMany: prisma.conversationParticipant.findMany,
    participantCount: prisma.conversationParticipant.count,
    participantUpdate: prisma.conversationParticipant.update,
    userFindUnique: prisma.user.findUnique,
    messageFindUnique: prisma.message.findUnique,
    transaction: prisma.$transaction,
    fetch: globalThis.fetch,
}

afterEach(() => {
    prisma.conversation.findUnique = originals.conversationFindUnique
    prisma.conversationParticipant.findMany = originals.participantFindMany
    prisma.conversationParticipant.count = originals.participantCount
    prisma.conversationParticipant.update = originals.participantUpdate
    prisma.user.findUnique = originals.userFindUnique
    prisma.message.findUnique = originals.messageFindUnique
    prisma.$transaction = originals.transaction
    globalThis.fetch = originals.fetch
})

const seller = { type: "client", userId: "u9" }
const outreachThread = {
    id: "c1",
    kind: "AGENCY_OUTREACH",
    closedAt: null,
    lastDeliveredAt: new Date(),
    dedupeKey: "AGENCY_OUTREACH:a:a1:p:p1",
    propertyId: "p1",
    propertySnapshot: null,
    property: null,
    messages: [],
    participants: [
        {
            id: "ps",
            userId: "u9",
            agencyId: null,
            isSeller: true,
            removed: false,
            blockedAt: null,
            displayName: "Марко П.",
        },
        {
            id: "pa",
            userId: null,
            agencyId: "a1",
            isSeller: false,
            removed: false,
            blockedAt: null,
            displayName: "Agency Dom",
        },
    ],
}

const failIfWritten = async () => {
    throw new Error("must not write")
}

// Review Focus 1
test("a legacy seller gets 404 on every by-id route of an outreach thread, and nothing is written", async () => {
    prisma.conversation.findUnique = async () => outreachThread
    prisma.conversationParticipant.update = failIfWritten
    prisma.$transaction = failIfWritten
    prisma.user.findUnique = async () => ({ id: "u9", role: "CLIENT", emailVerified: new Date(), messagingFlagged: false })

    assert.equal(await getThread(seller, "c1"), null)
    for (const action of [
        () => sendMessage({ conversationId: "c1", viewer: seller, bodyHtml: "<p>Здраво</p>" }),
        () => markRead({ conversationId: "c1", viewer: seller }),
        () => toggleBlock({ conversationId: "c1", viewer: seller }),
        () => reportConversation({ conversationId: "c1", viewer: seller, reason: "spam" }),
    ]) {
        await assert.rejects(action, { status: 404 })
    }
})

test("a legacy seller cannot remove an outreach thread", async () => {
    prisma.$transaction = async fn =>
        fn({
            conversation: { updateMany: async () => ({ count: 1 }), findUnique: async () => outreachThread },
        })
    await assert.rejects(() => removeConversation({ conversationId: "c1", viewer: seller }), { status: 404 })
})

test("inbox and unread count never include outreach threads for legacy callers", async () => {
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
    await getInbox(seller, {})
    await getUnreadConversationCount(seller)
    assert.equal(isConversationKindVisible("AGENCY_OUTREACH"), false)
    assert.ok(!inboxWhere.conversation.kind.in.includes("AGENCY_OUTREACH"))
    assert.ok(!countWhere.conversation.kind.in.includes("AGENCY_OUTREACH"))
})

// Review Focus 2
test("a caller with clientListings (app 1.1.0, sub-project D) can open the outreach thread", async () => {
    prisma.conversation.findUnique = async () => outreachThread
    const thread = await getThread(seller, "c1", "mk", { shortTermRent: true, clientListings: true })
    assert.equal(thread.id, "c1")
})

// Review Focus 4
test("no push for an agency's outreach message until sub-project D", async () => {
    prisma.message.findUnique = async () => ({
        id: "m1",
        conversationId: "c1",
        kind: "USER",
        status: "DELIVERED",
        bodyText: "Здраво",
        senderParticipantId: "pa",
        senderParticipant: { displayName: "Agency Dom" },
        conversation: {
            kind: "AGENCY_OUTREACH",
            participants: [
                { id: "pa", userId: null, user: null },
                {
                    id: "ps",
                    userId: "u9",
                    user: { role: "CLIENT", pushTokens: [{ id: "t1", token: "ExpoPushToken[x]" }] },
                },
            ],
        },
    })
    globalThis.fetch = async () => {
        throw new Error("Expo must not be called")
    }
    assert.equal(await sendChatPushNotification("m1"), false)
})

// Review Focus 5
test("the seller's chat notification about an outreach thread is dropped for legacy callers", async () => {
    let hiddenWhere
    const db = {
        conversation: {
            findMany: async ({ where }) => {
                hiddenWhere = where
                return [{ id: "c1" }]
            },
        },
    }
    const rows = [
        { id: "n1", metadata: { conversationId: "c1", link: "/mk/korisnicka-smetka/poraki/c1" } },
        { id: "n2", metadata: { conversationId: "c2", link: "/mk/korisnicka-smetka/poraki/c2" } },
    ]
    const visible = await withoutHiddenNotifications(rows, undefined, db)
    assert.deepEqual(
        visible.map(row => row.id),
        ["n2"]
    )
    assert.ok(hiddenWhere.kind.notIn.includes("AGENCY_INQUIRY"))
    assert.ok(!hiddenWhere.kind.notIn.includes("AGENCY_OUTREACH"))
})
