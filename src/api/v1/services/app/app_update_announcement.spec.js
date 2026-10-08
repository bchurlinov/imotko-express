import assert from "node:assert/strict"
import test from "node:test"
import { announceAppUpdate, selectAnnouncementRecipients } from "./app_update_announcement.service.js"

const tokens = [
    { id: "t1", token: "ExpoPushToken[a]", userId: "u1", locale: "mk", appVersion: null },
    { id: "t2", token: "ExpoPushToken[b]", userId: "u2", locale: "en", appVersion: null },
    { id: "t3", token: "ExpoPushToken[c]", userId: "u2", locale: "en", appVersion: "1.1.0" },
    { id: "t4", token: "ExpoPushToken[d]", userId: "u3", locale: "sq", appVersion: "1.0.9" },
]

test("only people who have no phone on the latest version get the announcement, on their old phones", () => {
    assert.deepEqual(selectAnnouncementRecipients(tokens, "1.1.0"), [
        { userId: "u1", locale: "mk", tokens: [{ id: "t1", token: "ExpoPushToken[a]" }] },
        { userId: "u3", locale: "sq", tokens: [{ id: "t4", token: "ExpoPushToken[d]" }] },
    ])
})

test("a dry run sends nothing and writes nothing", async () => {
    const prismaClient = {
        userPushToken: { findMany: async () => tokens },
        notification: {
            createMany: async () => {
                throw new Error("must not write")
            },
        },
    }
    const result = await announceAppUpdate({
        dryRun: true,
        latestVersion: "1.1.0",
        prismaClient,
        sendBatch: async () => {
            throw new Error("must not send")
        },
    })
    assert.deepEqual(result, { users: 2, tokens: 2, sent: 0 })
})

test("a confirmed run sends one push per old token and one notification per person, in their language", async () => {
    const sent = []
    let notifications
    const prismaClient = {
        userPushToken: { findMany: async () => tokens },
        notification: {
            createMany: async ({ data }) => {
                notifications = data
                return { count: data.length }
            },
        },
    }
    const result = await announceAppUpdate({
        dryRun: false,
        latestVersion: "1.1.0",
        prismaClient,
        sendBatch: async batch => {
            sent.push(...batch)
            return batch.map(() => ({ status: "ok" }))
        },
    })
    assert.equal(result.sent, 2)
    assert.equal(sent[0].title, "Нова верзија на Имотко")
    assert.deepEqual(sent[0].data, { type: "app_update" })
    assert.equal(notifications.length, 2)
    assert.equal(notifications[1].title, "Version i ri i Imotko")
})
