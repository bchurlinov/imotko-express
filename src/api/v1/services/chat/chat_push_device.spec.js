import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import prisma from "#database/client.js"
import { registerPushToken, sendChatPushNotification } from "./chat_push.service.js"
import { pushTokenAppVersion } from "#controllers/users/push_tokens.controller.js"

const originals = {
    messageFindUnique: prisma.message.findUnique,
    participantCount: prisma.conversationParticipant.count,
    tokenUpsert: prisma.userPushToken.upsert,
    ticketCreateMany: prisma.expoPushTicket.createMany,
    fetch: globalThis.fetch,
    minVersion: process.env.MOBILE_MIN_VERSION_CLIENT_LISTINGS,
}

beforeEach(() => {
    process.env.MOBILE_MIN_VERSION_CLIENT_LISTINGS = "1.1.0"
    prisma.expoPushTicket.createMany = async () => ({ count: 0 })
})

afterEach(() => {
    prisma.message.findUnique = originals.messageFindUnique
    prisma.conversationParticipant.count = originals.participantCount
    prisma.userPushToken.upsert = originals.tokenUpsert
    prisma.expoPushTicket.createMany = originals.ticketCreateMany
    globalThis.fetch = originals.fetch
    if (originals.minVersion === undefined) delete process.env.MOBILE_MIN_VERSION_CLIENT_LISTINGS
    else process.env.MOBILE_MIN_VERSION_CLIENT_LISTINGS = originals.minVersion
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
                user: {
                    role: "CLIENT",
                    pushTokens: [
                        { id: "old", token: "ExpoPushToken[old]", appVersion: null },
                        { id: "new", token: "ExpoPushToken[new]", appVersion: "1.1.0" },
                    ],
                },
            },
        ],
    },
})

const captureExpo = () => {
    const sent = []
    globalThis.fetch = async (url, { body }) => {
        sent.push(...JSON.parse(body))
        return { ok: true, json: async () => ({ data: [] }) }
    }
    return sent
}

const countByKinds = () => {
    prisma.conversationParticipant.count = async ({ where }) => where.conversation.kind.in.length
}

test("buyer–seller message pushes only 1.1.0 phone", async () => {
    prisma.message.findUnique = async () => message("PRIVATE_INQUIRY")
    countByKinds()
    const sent = captureExpo()
    assert.equal(await sendChatPushNotification("m1"), true)
    assert.deepEqual(sent.map(item => item.to), ["ExpoPushToken[new]"])
})

test("agency message reaches both phones with per-device badges", async () => {
    prisma.message.findUnique = async () => message("AGENCY_INQUIRY")
    countByKinds()
    const sent = captureExpo()
    await sendChatPushNotification("m1")
    const badges = Object.fromEntries(sent.map(item => [item.to, item.badge]))
    assert.equal(badges["ExpoPushToken[old]"], 1)
    assert.equal(badges["ExpoPushToken[new]"], 3)
})

test("nothing sends while minimum version unset", async () => {
    delete process.env.MOBILE_MIN_VERSION_CLIENT_LISTINGS
    prisma.message.findUnique = async () => message("AGENCY_OUTREACH")
    globalThis.fetch = async () => {
        throw new Error("Expo must not be called")
    }
    assert.equal(await sendChatPushNotification("m1"), false)
})

test("token registration stores and updates app version", async () => {
    let args
    prisma.userPushToken.upsert = async input => {
        args = input
        return {}
    }
    await registerPushToken({ userId: "u1", token: "ExpoPushToken[x]", platform: "ios", locale: "mk", appVersion: "1.1.0" })
    assert.equal(args.create.appVersion, "1.1.0")
    assert.equal(args.update.appVersion, "1.1.0")
    await registerPushToken({ userId: "u1", token: "ExpoPushToken[x]", platform: "ios", locale: "mk" })
    assert.equal(args.update.appVersion, null)
})

test("registered version only comes from a mobile caller with a valid version", () => {
    const request = headers => ({ get: name => headers[name] })
    assert.equal(pushTokenAppVersion(request({ "X-Imotko-Client": "mobile", "X-Imotko-App-Version": "1.1.0" })), "1.1.0")
    assert.equal(pushTokenAppVersion(request({ "X-Imotko-Client": "mobile", "X-Imotko-App-Version": "beta" })), null)
    assert.equal(pushTokenAppVersion(request({ "X-Imotko-App-Version": "1.1.0" })), null)
    assert.equal(pushTokenAppVersion(request({})), null)
})
