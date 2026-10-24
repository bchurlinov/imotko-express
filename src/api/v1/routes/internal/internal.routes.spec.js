import assert from "node:assert/strict"
import test from "node:test"
import { createFacebookPublicationHandler, isValidRevalidateSecret } from "./internal.routes.js"
import { enqueueFacebookPublication } from "#services/properties/facebook_publication_queue.service.js"

test("accepts the matching secret", () => {
    assert.equal(isValidRevalidateSecret("s3cret", "s3cret"), true)
})

test("rejects a different secret", () => {
    assert.equal(isValidRevalidateSecret("nope00", "s3cret"), false)
})

test("rejects when either side is missing", () => {
    assert.equal(isValidRevalidateSecret(undefined, "s3cret"), false)
    assert.equal(isValidRevalidateSecret("s3cret", undefined), false)
    assert.equal(isValidRevalidateSecret("", ""), false)
})

const validBody = { propertyId: "property-1", agencyId: "agency-1", revision: 1788948930000 }

const createRes = () => {
    const res = { statusCode: null, body: undefined }
    res.status = code => {
        res.statusCode = code
        return res
    }
    res.json = body => {
        res.body = body
        return res
    }
    return res
}

test("facebook publication: rejects callers without the internal secret", async () => {
    let enqueued = false
    const handler = createFacebookPublicationHandler({
        isTrusted: () => false,
        enqueue: async () => {
            enqueued = true
        },
    })
    const res = createRes()
    await handler({ body: validBody }, res)
    assert.equal(res.statusCode, 401)
    assert.equal(enqueued, false)
})

test("facebook publication: rejects an invalid body", async () => {
    const handler = createFacebookPublicationHandler({ isTrusted: () => true, enqueue: async () => ({}) })
    for (const body of [undefined, {}, { ...validBody, revision: "1" }, { ...validBody, propertyId: " " }]) {
        const res = createRes()
        await handler({ body }, res)
        assert.equal(res.statusCode, 400)
    }
})

test("facebook publication: enqueues and returns the job id", async () => {
    let received
    const handler = createFacebookPublicationHandler({
        isTrusted: () => true,
        enqueue: async request => {
            received = request
            return { id: "facebook-property-property-1-1788948930000" }
        },
    })
    const res = createRes()
    await handler({ body: validBody }, res)
    assert.equal(res.statusCode, 202)
    assert.deepEqual(received, validBody)
    assert.deepEqual(res.body, { jobId: "facebook-property-property-1-1788948930000" })
})

test("facebook publication: answers 503 when Redis is unavailable", async () => {
    const handler = createFacebookPublicationHandler({
        isTrusted: () => true,
        enqueue: async () => {
            throw new Error("Connection is closed.")
        },
    })
    const res = createRes()
    await handler({ body: validBody }, res)
    assert.equal(res.statusCode, 503)
})

test("facebook publication: job payload is identifiers-only, deduplicated by revision", async () => {
    let added
    await enqueueFacebookPublication(validBody, {
        getQueueImpl: () => ({
            add: async (...args) => {
                added = args
                return { id: args[2].jobId }
            },
        }),
    })
    assert.deepEqual(added, [
        "publish-approved-property",
        { propertyId: "property-1", agencyId: "agency-1" },
        { jobId: "facebook-property-property-1-1788948930000" },
    ])
})
