import assert from "node:assert/strict"
import { test } from "node:test"
import { scheduleAiPostprocess } from "./client_ai.service.js"

const baselineUpdatedAt = new Date(1788948930000)
const args = (patch = {}) => ({
    propertyId: "p1",
    baselineUpdatedAt,
    userId: "u1",
    orderPhotos: true,
    ...patch,
})
const flush = () => new Promise(resolve => setImmediate(resolve))

// Replaces console.error for one test and returns what was logged
const captureErrors = t => {
    const mock = t.mock.method(console, "error", () => {})
    return () => mock.mock.calls.map(call => call.arguments)
}

test("enqueues { propertyId, baselineUpdatedAt: ms, orderPhotos, userId } after the response", async () => {
    const enqueued = []
    let deferred
    scheduleAiPostprocess(args(), {
        enqueue: async request => enqueued.push(request),
        defer: fn => (deferred = fn),
    })

    assert.equal(typeof deferred, "function")
    assert.deepEqual(enqueued, [], "nothing is enqueued before the response")
    deferred()
    await flush()

    assert.deepEqual(enqueued, [{ propertyId: "p1", baselineUpdatedAt: 1788948930000, orderPhotos: true, userId: "u1" }])
    assert.equal(Number.isSafeInteger(enqueued[0].baselineUpdatedAt), true)
})

test("orderPhotos false is passed through and a numeric baseline is kept as is", async () => {
    const enqueued = []
    scheduleAiPostprocess(args({ orderPhotos: false, baselineUpdatedAt: 1788948930123 }), {
        enqueue: async request => enqueued.push(request),
        defer: fn => fn(),
    })
    await flush()

    assert.deepEqual(enqueued, [{ propertyId: "p1", baselineUpdatedAt: 1788948930123, orderPhotos: false, userId: "u1" }])
})

test("the userId key is omitted when absent, and the payload never carries listing text", async () => {
    const enqueued = []
    const enqueue = async request => enqueued.push(request)
    const withText = { submittedBody: { name: "Тајен наслов 070 123 456", description: "Тајен опис на огласот" } }
    scheduleAiPostprocess(args({ userId: undefined, ...withText }), { enqueue, defer: fn => fn() })
    scheduleAiPostprocess(args({ userId: null, ...withText }), { enqueue, defer: fn => fn() })
    await flush()

    assert.equal(enqueued.length, 2)
    for (const request of enqueued) {
        assert.deepEqual(Object.keys(request).sort(), ["baselineUpdatedAt", "orderPhotos", "propertyId"])
        assert.equal(JSON.stringify(request).includes("Тајен"), false)
    }
})

test("an enqueue rejection is logged by error name only and does not throw", async t => {
    const logged = captureErrors(t)
    let deferred
    scheduleAiPostprocess(args(), {
        enqueue: async () => {
            const error = new TypeError("Тајен опис на огласот 070 123 456")
            error.requestBodyValues = { description: "Тајен опис на огласот" }
            throw error
        },
        defer: fn => (deferred = fn),
    })

    assert.doesNotThrow(() => deferred())
    await flush()

    const lines = logged()
    assert.equal(lines.length, 1)
    const text = lines[0].map(part => (typeof part === "string" ? part : JSON.stringify(part))).join(" ")
    assert.match(text, /\[AI_PROPERTY_POSTPROCESS\]/)
    assert.match(text, /TypeError/)
    assert.equal(text.includes("Тајен"), false)
    assert.equal(text.includes("070 123 456"), false)
    assert.equal(lines[0].every(part => typeof part === "string"), true, "no error object is passed to the logger")
})

test("a synchronous enqueue throw is logged by name only and does not throw", async t => {
    const logged = captureErrors(t)
    scheduleAiPostprocess(args(), {
        enqueue: () => {
            throw new RangeError("Тајен опис на огласот")
        },
        defer: fn => fn(),
    })
    await flush()

    const lines = logged()
    assert.equal(lines.length, 1)
    const text = lines[0].join(" ")
    assert.match(text, /RangeError/)
    assert.equal(text.includes("Тајен"), false)
})

test("an error without a usable name is still logged without throwing", async t => {
    const logged = captureErrors(t)
    scheduleAiPostprocess(args(), {
        enqueue: async () => Promise.reject("Тајен опис на огласот"),
        defer: fn => fn(),
    })
    await flush()

    const lines = logged()
    assert.equal(lines.length, 1)
    assert.equal(lines[0].join(" ").includes("Тајен"), false)
})
