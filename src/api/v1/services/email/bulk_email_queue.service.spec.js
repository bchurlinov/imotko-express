import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PENDING_CLAIM_TTL_SECONDS, getBulkEmailCampaignStatus, queueBulkEmailCampaign } from "./bulk_email_queue.service.js"
import {
    BULK_EMAIL_JOB_NAME,
    CAMPAIGN_TTL_SECONDS,
    campaignKey,
    claimKey,
    getBulkEmailJobId,
} from "../../../../../workers/bulk-email/campaign_store.js"

const CAMPAIGN_ID = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d"
const campaign = (overrides = {}) => ({
    campaignId: CAMPAIGN_ID,
    subject: "Новост",
    html: "<p>Hi</p>",
    replyTo: "contact@imotko.mk",
    deliveryMode: "real",
    recipients: [
        { email: "a@x.mk", unsubscribeLink: "https://imotko.mk/mk/otkazi-izvestuvanja/t1" },
        { email: "b@x.mk", unsubscribeLink: "" },
    ],
    excluded: 1,
    ...overrides,
})

const createFakes = ({ failAdd = false, hang = false } = {}) => {
    const strings = new Map()
    const hashes = new Map()
    const ttl = new Map()
    const added = []
    const redis = {
        strings,
        hashes,
        ttl,
        set: async (key, value, ex, seconds, nx) => {
            assert.equal(ex, "EX")
            if (nx === "NX" && strings.has(key)) return null
            strings.set(key, value)
            ttl.set(key, seconds)
            return "OK"
        },
        get: async key => strings.get(key) ?? null,
        del: async (...keys) => keys.forEach(key => (strings.delete(key), hashes.delete(key))),
        hgetall: async key => ({ ...(hashes.get(key) || {}) }),
        lrange: async () => [],
        multi: () => {
            const ops = []
            const chain = {
                hset: (key, fields) => (ops.push(() => hashes.set(key, { ...fields })), chain),
                expire: (key, seconds) => (ops.push(() => ttl.set(key, seconds)), chain),
                exec: async () => ops.map(op => op()),
            }
            return chain
        },
    }
    const queue = {
        addBulk: async jobs => {
            if (hang) return new Promise(() => {})
            if (failAdd) throw new Error("boom")
            added.push(...jobs)
            return jobs
        },
    }
    return { redis, queue, added, deps: { getConnection: () => redis, getQueueImpl: () => queue } }
}

describe("queueBulkEmailCampaign", () => {
    it("stores the campaign once and queues one job per recipient", async () => {
        const { redis, added, deps } = createFakes()
        const now = () => new Date("2026-10-24T10:00:00.000Z")

        const result = await queueBulkEmailCampaign(campaign(), { ...deps, now })

        assert.deepEqual(result, { campaignId: CAMPAIGN_ID, queued: 2, excluded: 1, duplicate: false })
        assert.deepEqual(redis.hashes.get(campaignKey(CAMPAIGN_ID)), {
            subject: "Новост",
            html: "<p>Hi</p>",
            replyTo: "contact@imotko.mk",
            deliveryMode: "real",
            total: 2,
            excluded: 1,
            sent: 0,
            failed: 0,
            createdAt: "2026-10-24T10:00:00.000Z",
        })
        assert.equal(redis.ttl.get(campaignKey(CAMPAIGN_ID)), CAMPAIGN_TTL_SECONDS)
        assert.equal(redis.strings.get(claimKey(CAMPAIGN_ID)), "queued")
        assert.equal(redis.ttl.get(claimKey(CAMPAIGN_ID)), CAMPAIGN_TTL_SECONDS)
        assert.deepEqual(added, [
            {
                name: BULK_EMAIL_JOB_NAME,
                data: { campaignId: CAMPAIGN_ID, email: "a@x.mk", unsubscribeLink: "https://imotko.mk/mk/otkazi-izvestuvanja/t1" },
                opts: { jobId: getBulkEmailJobId({ campaignId: CAMPAIGN_ID, email: "a@x.mk" }) },
            },
            {
                name: BULK_EMAIL_JOB_NAME,
                data: { campaignId: CAMPAIGN_ID, email: "b@x.mk", unsubscribeLink: "" },
                opts: { jobId: getBulkEmailJobId({ campaignId: CAMPAIGN_ID, email: "b@x.mk" }) },
            },
        ])
    })

    it("queues nothing the second time the same campaign id arrives", async () => {
        const { added, deps } = createFakes()
        await queueBulkEmailCampaign(campaign(), deps)
        added.length = 0

        const again = await queueBulkEmailCampaign(campaign(), deps)

        assert.equal(again.duplicate, true)
        assert.equal(again.queued, 0)
        assert.equal(again.campaignId, CAMPAIGN_ID)
        assert.deepEqual(added, [])
    })

    it("answers 'still queueing' instead of 'already queued' while another request holds a short pending claim", async () => {
        const { redis, added, deps } = createFakes()
        await redis.set(claimKey(CAMPAIGN_ID), "pending", "EX", PENDING_CLAIM_TTL_SECONDS, "NX")

        await assert.rejects(queueBulkEmailCampaign(campaign(), deps), error => error.code === "CAMPAIGN_PENDING")
        assert.deepEqual(added, [])
    })

    it("claims a campaign only briefly until its jobs are queued, so a crashed request frees it by itself", async () => {
        const { redis, deps } = createFakes()
        const claims = []
        const set = redis.set
        redis.set = async (...args) => (claims.push(args), set(...args))

        await queueBulkEmailCampaign(campaign(), deps)

        assert.deepEqual(claims[0], [claimKey(CAMPAIGN_ID), "pending", "EX", PENDING_CLAIM_TTL_SECONDS, "NX"])
        assert.ok(PENDING_CLAIM_TTL_SECONDS <= 120)
    })

    it("releases the campaign id when queueing failed, so the admin can retry", async () => {
        const failing = createFakes({ failAdd: true })
        await assert.rejects(queueBulkEmailCampaign(campaign(), failing.deps), /boom/)
        assert.equal(failing.redis.strings.has(claimKey(CAMPAIGN_ID)), false)
        assert.equal(failing.redis.hashes.has(campaignKey(CAMPAIGN_ID)), false)
    })

    it("gives up after the timeout instead of hanging the request", async () => {
        const { deps } = createFakes({ hang: true })
        await assert.rejects(queueBulkEmailCampaign(campaign(), { ...deps, timeoutMs: 20 }), /did not answer/)
    })
})

describe("getBulkEmailCampaignStatus", () => {
    it("returns null for an unknown campaign", async () => {
        const { deps } = createFakes()
        assert.equal(await getBulkEmailCampaignStatus(CAMPAIGN_ID, deps), null)
    })

    it("returns the progress of a queued campaign", async () => {
        const { deps } = createFakes()
        await queueBulkEmailCampaign(campaign(), deps)
        const status = await getBulkEmailCampaignStatus(CAMPAIGN_ID, deps)
        assert.equal(status.total, 2)
        assert.equal(status.sent, 0)
        assert.equal(status.done, false)
    })
})
