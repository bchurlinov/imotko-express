import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createBulkEmailProcessor, isSesThrottle } from "./processor.js"
import { campaignKey } from "./campaign_store.js"

const CAMPAIGN_ID = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d"
const FROM = "Imotko <info@imotko.mk>"
const LINK = "https://imotko.mk/mk/otkazi-izvestuvanja/t1"

const createRedis = (campaign = {}) => {
    const hash = {
        subject: "Новост",
        html: '<html><body><img src="https://imotko.mk/icons/logo_email.png"><p>Hi</p></body></html>',
        replyTo: "contact@imotko.mk",
        deliveryMode: "real",
        total: "1",
        sent: "0",
        failed: "0",
        ...campaign,
    }
    const hashes = new Map(campaign === null ? [] : [[campaignKey(CAMPAIGN_ID), hash]])
    return {
        hashes,
        hgetall: async key => ({ ...(hashes.get(key) || {}) }),
        exists: async key => (hashes.has(key) ? 1 : 0),
        multi: () => {
            const ops = []
            const chain = {
                hincrby: (key, field, by) => (ops.push(() => (hashes.get(key)[field] = String(Number(hashes.get(key)[field]) + by))), chain),
                exec: async () => ops.map(op => op()),
            }
            return chain
        },
    }
}

const job = (data = {}) => ({ id: "job-1", data: { campaignId: CAMPAIGN_ID, email: "a@x.mk", unsubscribeLink: LINK, ...data } })
const decodeHtml = raw => {
    const start = raw.indexOf("Content-Type: text/html")
    const body = raw.slice(raw.indexOf("\r\n\r\n", start) + 4)
    return Buffer.from(body.slice(0, body.indexOf("\r\n--")).replace(/\r\n/g, ""), "base64").toString("utf8")
}

const setup = ({ campaign, env = { ENV: "production" }, send } = {}) => {
    const redis = createRedis(campaign)
    const sent = []
    const processor = createBulkEmailProcessor({
        redis,
        from: FROM,
        env,
        sendRawEmail: send || (async message => sent.push(message)),
        onThrottle: async () => {
            throw new Error("rate-limited")
        },
    })
    return { redis, sent, processor }
}

describe("bulk email processor", () => {
    it("sends one raw email with the footer, the recipient's opt-out line and the inline logo", async () => {
        const { redis, sent, processor } = setup()
        await processor(job())

        assert.equal(sent.length, 1)
        const [{ raw, destinations, from }] = sent
        assert.deepEqual(destinations, ["a@x.mk"])
        assert.equal(from, FROM)
        assert.ok(raw.includes("To: a@x.mk\r\n"))
        assert.ok(raw.includes("Reply-To: contact@imotko.mk\r\n"))
        assert.ok(raw.includes("Content-ID: <logo-email@imotko.mk>"))
        const html = decodeHtml(raw)
        assert.ok(html.includes('data-imotko-footer="true"'))
        assert.ok(html.includes(`<a href="${LINK}"`))
        assert.ok(html.includes("Исклучете ги известувањата по е-пошта"))
        assert.ok(html.includes("cid:logo-email@imotko.mk"))
        assert.equal(redis.hashes.get(campaignKey(CAMPAIGN_ID)).sent, "1")
    })

    it("leaves out the opt-out line when the recipient has no link", async () => {
        const { sent, processor } = setup()
        await processor(job({ unsubscribeLink: "" }))
        assert.ok(!decodeHtml(sent[0].raw).includes("Исклучете ги известувањата"))
    })

    it("redirects a campaign queued by a non-production web app to the dev inbox, even on a production worker", async () => {
        const { sent, processor } = setup({ campaign: { deliveryMode: "redirect" } })
        await processor(job())
        assert.notDeepEqual(sent[0].destinations, ["a@x.mk"])
        assert.ok(!sent[0].raw.includes("a@x.mk"))
    })

    it("redirects everything when the worker itself is not production", async () => {
        const { sent, processor } = setup({ env: { ENV: "development" } })
        await processor(job())
        assert.notDeepEqual(sent[0].destinations, ["a@x.mk"])
    })

    it("fails for good, without sending, when the campaign is gone", async () => {
        const { sent, processor } = setup({ campaign: null })
        await assert.rejects(processor(job()), error => error.name === "UnrecoverableError")
        assert.equal(sent.length, 0)
    })

    it("hands SES throttling to the rate limiter instead of failing the attempt", async () => {
        const throttle = Object.assign(new Error("Maximum sending rate exceeded."), { name: "Throttling" })
        const { redis, processor } = setup({ send: async () => Promise.reject(throttle) })
        await assert.rejects(processor(job()), /rate-limited/)
        assert.equal(redis.hashes.get(campaignKey(CAMPAIGN_ID)).sent, "0")
    })

    it("rethrows other SES errors so BullMQ retries them", async () => {
        const { processor } = setup({ send: async () => Promise.reject(new Error("MessageRejected")) })
        await assert.rejects(processor(job()), /MessageRejected/)
    })

    it("recognizes SES throttling errors", () => {
        assert.equal(isSesThrottle({ name: "Throttling" }), true)
        assert.equal(isSesThrottle({ name: "x", message: "Maximum sending rate exceeded." }), true)
        assert.equal(isSesThrottle(new Error("MessageRejected")), false)
    })
})
