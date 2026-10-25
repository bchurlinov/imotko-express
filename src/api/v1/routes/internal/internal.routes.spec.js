import assert from "node:assert/strict"
import test from "node:test"
import {
    createBulkEmailHandler,
    createBulkEmailStatusHandler,
    createFacebookPublicationHandler,
    isValidRevalidateSecret,
} from "./internal.routes.js"
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

test("facebook publication: enqueue gives up instead of hanging while Redis is unreachable", async () => {
    await assert.rejects(
        enqueueFacebookPublication(validBody, {
            getQueueImpl: () => ({ add: () => new Promise(() => {}) }),
            timeoutMs: 20,
        }),
        /did not answer/
    )
})

const CAMPAIGN_ID = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d"
const bulkBody = {
    campaignId: CAMPAIGN_ID,
    subject: "Новост",
    fromEmail: "contact@imotko.mk",
    message: '<p>Hi<script>x</script></p>',
    recipientMode: "agencies",
    recipients: ["a@x.mk", "b@x.mk"],
    deliveryMode: "real",
}

const bulkHandler = (overrides = {}) => {
    const calls = { queued: null, resolved: null }
    const handler = createBulkEmailHandler({
        isTrusted: () => true,
        resolveRecipients: async emails => {
            calls.resolved = emails
            return { recipients: emails.map(email => ({ email, unsubscribeLink: "" })), excluded: [] }
        },
        queueCampaign: async campaign => {
            calls.queued = campaign
            return { campaignId: campaign.campaignId, queued: campaign.recipients.length, excluded: campaign.excluded, duplicate: false }
        },
        ...overrides,
    })
    return { handler, calls }
}

test("bulk email: rejects callers without the internal secret", async () => {
    const { handler, calls } = bulkHandler({ isTrusted: () => false })
    const res = createRes()
    await handler({ body: bulkBody }, res)
    assert.equal(res.statusCode, 401)
    assert.equal(calls.queued, null)
})

test("bulk email: answers 400 with the reason for an invalid request", async () => {
    const { handler } = bulkHandler()
    const res = createRes()
    await handler({ body: { ...bulkBody, recipients: ["bad"] } }, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, { message: "One or more recipient emails are invalid.", invalidEmails: ["bad"] })
})

test("bulk email: sanitizes, renders and queues the resolved recipients", async () => {
    const { handler, calls } = bulkHandler()
    const res = createRes()
    await handler({ body: bulkBody }, res)
    assert.equal(res.statusCode, 202)
    assert.deepEqual(res.body, { campaignId: CAMPAIGN_ID, queued: 2, excluded: 0, duplicate: false })
    assert.deepEqual(calls.resolved, ["a@x.mk", "b@x.mk"])
    assert.equal(calls.queued.subject, "Новост")
    assert.equal(calls.queued.replyTo, "contact@imotko.mk")
    assert.equal(calls.queued.deliveryMode, "real")
    assert.ok(calls.queued.html.includes("<p>Hi</p>"))
    assert.ok(!calls.queued.html.includes("<script>"))
})

test("bulk email: custom addresses go out as typed, without the opt-out lookup", async () => {
    const { handler, calls } = bulkHandler()
    const res = createRes()
    await handler({ body: { ...bulkBody, recipientMode: "custom" } }, res)
    assert.equal(res.statusCode, 202)
    assert.equal(calls.resolved, null)
    assert.deepEqual(calls.queued.recipients, [
        { email: "a@x.mk", unsubscribeLink: "" },
        { email: "b@x.mk", unsubscribeLink: "" },
    ])
})

test("bulk email: answers 422 when everyone opted out", async () => {
    const { handler, calls } = bulkHandler({
        resolveRecipients: async emails => ({ recipients: [], excluded: emails }),
    })
    const res = createRes()
    await handler({ body: bulkBody }, res)
    assert.equal(res.statusCode, 422)
    assert.deepEqual(res.body, { message: "No recipients left: 2 opted out of emails.", excluded: 2 })
    assert.equal(calls.queued, null)
})

test("bulk email: answers 503 when the queue is unavailable", async () => {
    const { handler } = bulkHandler({
        queueCampaign: async () => {
            throw new Error("Redis did not answer within 10000ms")
        },
    })
    const res = createRes()
    await handler({ body: bulkBody }, res)
    assert.equal(res.statusCode, 503)
})

test("bulk email: answers 409 while the same campaign is still being queued", async () => {
    const { handler } = bulkHandler({
        queueCampaign: async () => {
            throw Object.assign(new Error("pending"), { code: "CAMPAIGN_PENDING" })
        },
    })
    const res = createRes()
    await handler({ body: bulkBody }, res)
    assert.equal(res.statusCode, 409)
    assert.match(res.body.message, /still being queued/)
})

test("bulk email: test campaigns (redirected to the dev inbox) carry no real opt-out links", async () => {
    const { handler, calls } = bulkHandler({
        resolveRecipients: async emails => ({
            recipients: emails.map(email => ({ email, unsubscribeLink: "https://imotko.mk/mk/otkazi-izvestuvanja/real-token" })),
            excluded: [],
        }),
    })
    const res = createRes()
    await handler({ body: { ...bulkBody, deliveryMode: "redirect" } }, res)
    assert.equal(res.statusCode, 202)
    assert.ok(calls.queued.recipients.every(recipient => recipient.unsubscribeLink === ""))

    await handler({ body: { ...bulkBody, campaignId: "4f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d" } }, createRes())
    assert.ok(calls.queued.recipients.every(recipient => recipient.unsubscribeLink.includes("real-token")))
})

test("bulk email status: 401 / 400 / 404 / 200 / 503", async () => {
    const status = { campaignId: CAMPAIGN_ID, total: 2, sent: 1, failed: 0, excluded: 0, failedEmails: [], done: false }
    const cases = [
        [{ isTrusted: () => false, getStatus: async () => status }, CAMPAIGN_ID, 401],
        [{ isTrusted: () => true, getStatus: async () => status }, "nope", 400],
        [{ isTrusted: () => true, getStatus: async () => null }, CAMPAIGN_ID, 404],
        [{ isTrusted: () => true, getStatus: async () => status }, CAMPAIGN_ID, 200],
        [{ isTrusted: () => true, getStatus: async () => Promise.reject(new Error("down")) }, CAMPAIGN_ID, 503],
    ]
    for (const [deps, campaignId, expected] of cases) {
        const res = createRes()
        await createBulkEmailStatusHandler(deps)({ params: { campaignId } }, res)
        assert.equal(res.statusCode, expected, `campaign ${campaignId} → ${expected}`)
        if (expected === 200) assert.deepEqual(res.body, status)
    }
})
