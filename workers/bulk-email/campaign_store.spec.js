import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
    CAMPAIGN_TTL_SECONDS,
    FAILED_EMAILS_LIMIT,
    campaignKey,
    getBulkEmailJobId,
    readCampaign,
    readCampaignStatus,
    recordFailed,
    recordSent,
} from "./campaign_store.js"

const CAMPAIGN_ID = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d"

// Just enough of ioredis for the store: hashes, lists, EXPIRE and EXISTS
const createFakeRedis = () => {
    const hashes = new Map()
    const lists = new Map()
    const ttl = new Map()
    const redis = {
        hashes,
        lists,
        ttl,
        hgetall: async key => ({ ...(hashes.get(key) || {}) }),
        exists: async key => (hashes.has(key) ? 1 : 0),
        lrange: async (key, start, stop) => (lists.get(key) || []).slice(start, stop + 1),
        multi: () => {
            const ops = []
            const chain = {
                hincrby: (key, field, by) => {
                    ops.push(() => {
                        const hash = hashes.get(key) || {}
                        hash[field] = String(Number(hash[field] || 0) + by)
                        hashes.set(key, hash)
                    })
                    return chain
                },
                rpush: (key, value) => {
                    ops.push(() => lists.set(key, [...(lists.get(key) || []), value]))
                    return chain
                },
                ltrim: (key, start, stop) => {
                    ops.push(() => lists.set(key, (lists.get(key) || []).slice(start, stop + 1)))
                    return chain
                },
                expire: (key, seconds) => {
                    ops.push(() => ttl.set(key, seconds))
                    return chain
                },
                exec: async () => ops.map(op => [null, op()]),
            }
            return chain
        },
    }
    return redis
}

const seed = (redis, fields = {}) =>
    redis.hashes.set(campaignKey(CAMPAIGN_ID), {
        subject: "Hello",
        html: "<p>Hi</p>",
        replyTo: "contact@imotko.mk",
        deliveryMode: "real",
        total: "3",
        excluded: "1",
        sent: "0",
        failed: "0",
        createdAt: "2026-10-24T10:00:00.000Z",
        ...fields,
    })

describe("bulk email campaign store", () => {
    it("keeps campaigns for 7 days", () => {
        assert.equal(CAMPAIGN_TTL_SECONDS, 604800)
    })

    it("builds one stable job id per campaign and address without the address in it", () => {
        const id = getBulkEmailJobId({ campaignId: CAMPAIGN_ID, email: "a@x.mk" })
        assert.match(id, new RegExp(`^bulk-email-${CAMPAIGN_ID}-[0-9a-f]{16}$`))
        assert.equal(id, getBulkEmailJobId({ campaignId: CAMPAIGN_ID, email: "a@x.mk" }))
        assert.notEqual(id, getBulkEmailJobId({ campaignId: CAMPAIGN_ID, email: "b@x.mk" }))
        assert.ok(!id.includes("x.mk"))
    })

    it("reads a stored campaign, or null once it expired", async () => {
        const redis = createFakeRedis()
        assert.equal(await readCampaign(redis, CAMPAIGN_ID), null)
        seed(redis)
        const campaign = await readCampaign(redis, CAMPAIGN_ID)
        assert.equal(campaign.subject, "Hello")
        assert.equal(campaign.deliveryMode, "real")
    })

    it("reports progress with numbers and a done flag", async () => {
        const redis = createFakeRedis()
        seed(redis, { sent: "2", failed: "1" })
        redis.lists.set(`${campaignKey(CAMPAIGN_ID)}:failed`, ["c@x.mk"])

        assert.deepEqual(await readCampaignStatus(redis, CAMPAIGN_ID), {
            campaignId: CAMPAIGN_ID,
            total: 3,
            sent: 2,
            failed: 1,
            excluded: 1,
            failedEmails: ["c@x.mk"],
            done: true,
            createdAt: "2026-10-24T10:00:00.000Z",
        })
    })

    it("is not done while emails are still waiting", async () => {
        const redis = createFakeRedis()
        seed(redis, { sent: "1" })
        assert.equal((await readCampaignStatus(redis, CAMPAIGN_ID)).done, false)
    })

    it("returns null status for an unknown campaign", async () => {
        assert.equal(await readCampaignStatus(createFakeRedis(), CAMPAIGN_ID), null)
    })

    it("counts sent and failed emails and caps the failed list", async () => {
        const redis = createFakeRedis()
        seed(redis)
        await recordSent(redis, CAMPAIGN_ID)
        for (let i = 0; i < FAILED_EMAILS_LIMIT + 5; i++) await recordFailed(redis, CAMPAIGN_ID, `f${i}@x.mk`)

        const status = await readCampaignStatus(redis, CAMPAIGN_ID)
        assert.equal(status.sent, 1)
        assert.equal(status.failed, FAILED_EMAILS_LIMIT + 5)
        assert.equal(status.failedEmails.length, FAILED_EMAILS_LIMIT)
        assert.equal(redis.ttl.get(`${campaignKey(CAMPAIGN_ID)}:failed`), CAMPAIGN_TTL_SECONDS)
    })

    it("does not recreate an expired campaign when a late result comes in", async () => {
        const redis = createFakeRedis()
        await recordSent(redis, CAMPAIGN_ID)
        await recordFailed(redis, CAMPAIGN_ID, "a@x.mk")
        assert.equal(redis.hashes.size, 0)
        assert.equal(redis.lists.size, 0)
    })
})
