import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { sendChatPushNotification } from "./chat_push.service.js"

const originals = {
    messageFindUnique: prisma.message.findUnique,
    participantCount: prisma.conversationParticipant.count,
    fetch: globalThis.fetch,
}

afterEach(() => {
    prisma.message.findUnique = originals.messageFindUnique
    prisma.conversationParticipant.count = originals.participantCount
    globalThis.fetch = originals.fetch
})

const message = kind => ({
    id: "m1",
    conversationId: "c1",
    kind: "USER",
    status: "DELIVERED",
    bodyText: "Hi",
    senderParticipantId: "ps",
    senderParticipant: { displayName: "Марко П." },
    conversation: {
        kind,
        participants: [
            { id: "ps", userId: "u9", user: { role: "CLIENT", pushTokens: [] } },
            {
                id: "pb",
                userId: "u1",
                user: { role: "CLIENT", pushTokens: [{ id: "t1", token: "ExpoPushToken[x]" }] },
            },
        ],
    },
})

test("no push for a buyer–seller message until sub-project D", async () => {
    prisma.message.findUnique = async () => message("PRIVATE_INQUIRY")
    globalThis.fetch = async () => {
        throw new Error("Expo must not be called")
    }
    assert.equal(await sendChatPushNotification("m1"), false)
})

// Review Focus 2
test("the badge of an agency-thread push counts agency threads only", async () => {
    let badgeWhere
    prisma.message.findUnique = async () => message("AGENCY_INQUIRY")
    prisma.conversationParticipant.count = async ({ where }) => {
        badgeWhere = where
        return 1
    }
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) })
    await sendChatPushNotification("m1")
    assert.deepEqual(badgeWhere.conversation.kind, { in: ["AGENCY_INQUIRY"] })
})
