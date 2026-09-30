import assert from "node:assert/strict"
import test from "node:test"
import { MessageKind, MessageStatus } from "#generated/prisma/enums.ts"
import { CHAT_ERRORS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"
import { requestMessagePush } from "./chat_push.service.js"

const now = new Date("2026-09-30T12:00:00.000Z")
const viewer = { type: "agency", userId: "agency-user" }

const deliveredMessage = overrides => ({
    id: "message-1",
    kind: MessageKind.USER,
    status: MessageStatus.DELIVERED,
    senderUserId: viewer.userId,
    deliveredAt: new Date("2026-09-30T11:58:00.000Z"),
    ...overrides,
})

const request = async ({ message = deliveredMessage(), ticket = null } = {}) => {
    const queued = []
    const result = await requestMessagePush({
        messageId: "message-1",
        viewer,
        now,
        prismaClient: {
            message: { findUnique: async () => message },
            expoPushTicket: { findFirst: async () => ticket },
        },
        queuePush: messageId => queued.push(messageId),
    })
    return { result, queued }
}

test("queues a fresh delivered user message owned by the viewer", async () => {
    const { result, queued } = await request()

    assert.equal(result, true)
    assert.deepEqual(queued, ["message-1"])
})

test("does not reveal or queue a message the viewer did not send", async () => {
    await assert.rejects(
        request({ message: deliveredMessage({ senderUserId: "another-user" }) }),
        error => error instanceof ChatError && error.code === CHAT_ERRORS.MESSAGE_NOT_FOUND && error.status === 404
    )
})

test("skips messages that are not delivered user messages", async () => {
    for (const message of [
        deliveredMessage({ kind: MessageKind.SYSTEM }),
        deliveredMessage({ status: MessageStatus.PENDING_REVIEW, deliveredAt: null }),
    ]) {
        const { result, queued } = await request({ message })
        assert.equal(result, false)
        assert.deepEqual(queued, [])
    }
})

test("skips stale messages and messages with an Expo ticket", async () => {
    const stale = await request({ message: deliveredMessage({ deliveredAt: new Date("2026-09-30T11:54:59.999Z") }) })
    assert.equal(stale.result, false)
    assert.deepEqual(stale.queued, [])

    const duplicate = await request({ ticket: { id: "ticket-1" } })
    assert.equal(duplicate.result, false)
    assert.deepEqual(duplicate.queued, [])
})
