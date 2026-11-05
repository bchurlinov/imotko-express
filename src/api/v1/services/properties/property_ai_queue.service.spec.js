import assert from "node:assert/strict"
import test from "node:test"
import {
    PROPERTY_AI_JOB_OPTIONS,
    closePropertyAiQueue,
    enqueuePropertyAi,
    getPropertyAiJobId,
    parsePropertyAiRequest,
} from "./property_ai_queue.service.js"
import { PROPERTY_AI_QUEUE_NAME } from "../../../../../workers/property-ai-postprocess/queue_name.js"

const valid = { propertyId: "p1", baselineUpdatedAt: 1788948930000, orderPhotos: true }

test("queue name", () => {
    assert.equal(PROPERTY_AI_QUEUE_NAME, "property-ai-postprocess")
})

test("parse accepts a minimal and a full request", () => {
    assert.deepEqual(parsePropertyAiRequest(valid), valid)
    assert.deepEqual(parsePropertyAiRequest({ ...valid, orderPhotos: false, userId: "u1", facebookRevision: 7 }), {
        ...valid,
        orderPhotos: false,
        userId: "u1",
        facebookRevision: 7,
    })
    assert.deepEqual(parsePropertyAiRequest({ ...valid, propertyId: "  p1  " }), valid)
})

test("parse rejects", () => {
    const invalid = [
        undefined,
        null,
        "string",
        {},
        { ...valid, propertyId: undefined },
        { ...valid, propertyId: "   " },
        { ...valid, propertyId: 5 },
        { ...valid, baselineUpdatedAt: undefined },
        { ...valid, baselineUpdatedAt: 0 },
        { ...valid, baselineUpdatedAt: -1 },
        { ...valid, baselineUpdatedAt: 1.5 },
        { ...valid, baselineUpdatedAt: "1788948930000" },
        { ...valid, baselineUpdatedAt: Number.NaN },
        { ...valid, orderPhotos: undefined },
        { ...valid, orderPhotos: "true" },
        { ...valid, orderPhotos: 1 },
        { ...valid, facebookRevision: 0 },
        { ...valid, facebookRevision: -3 },
        { ...valid, facebookRevision: 1.5 },
        { ...valid, facebookRevision: "5" },
        { ...valid, facebookRevision: null },
    ]
    for (const body of invalid) {
        assert.equal(parsePropertyAiRequest(body), null, JSON.stringify(body))
    }
})

test("parse keeps only known fields", () => {
    const parsed = parsePropertyAiRequest({ ...valid, name: "SECRET", description: "SECRET", extra: { a: 1 } })
    assert.deepEqual(parsed, valid)
    assert.equal("name" in parsed, false)
    assert.equal(JSON.stringify(parsed).includes("SECRET"), false)
})

test("job id", () => {
    assert.equal(getPropertyAiJobId({ propertyId: "p1", baselineUpdatedAt: 5 }), "property-ai-p1-5")
})

test("job options", () => {
    assert.deepEqual(PROPERTY_AI_JOB_OPTIONS, {
        attempts: 5,
        backoff: { type: "exponential", delay: 120000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
    })
})

test("enqueue uses the job id and an identifiers-only payload", async () => {
    let added
    const job = await enqueuePropertyAi(
        { ...valid, userId: "u1", facebookRevision: 9, name: "SECRET" },
        {
            getQueueImpl: () => ({
                add: async (...args) => {
                    added = args
                    return { id: args[2].jobId }
                },
            }),
        }
    )
    assert.deepEqual(added, [
        "property-ai-postprocess",
        { propertyId: "p1", baselineUpdatedAt: 1788948930000, orderPhotos: true, userId: "u1", facebookRevision: 9 },
        { jobId: "property-ai-p1-1788948930000" },
    ])
    assert.equal(job.id, "property-ai-p1-1788948930000")
    assert.equal(JSON.stringify(added).includes("SECRET"), false)
})

test("enqueue omits absent optional fields from the payload", async () => {
    let payload
    await enqueuePropertyAi(valid, {
        getQueueImpl: () => ({
            add: async (_name, data) => {
                payload = data
                return { id: "x" }
            },
        }),
    })
    assert.deepEqual(payload, valid)
    assert.deepEqual(Object.keys(payload).sort(), ["baselineUpdatedAt", "orderPhotos", "propertyId"])
})

test("enqueue rejects when Redis does not answer within timeoutMs", async () => {
    await assert.rejects(
        enqueuePropertyAi(valid, {
            getQueueImpl: () => ({ add: () => new Promise(() => {}) }),
            timeoutMs: 20,
        }),
        /did not answer within 20ms/
    )
})

test("enqueue passes through a queue rejection", async () => {
    await assert.rejects(
        enqueuePropertyAi(valid, {
            getQueueImpl: () => ({
                add: async () => {
                    throw new Error("Connection is closed.")
                },
            }),
        }),
        /Connection is closed/
    )
})

test("close is a no-op when no queue was opened", async () => {
    await closePropertyAiQueue()
})
