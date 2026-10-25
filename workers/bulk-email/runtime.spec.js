import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BULK_EMAIL_QUEUE_NAME, campaignKey } from "./campaign_store.js"
import { startBulkEmailWorker } from "./runtime.js"

const CAMPAIGN_ID = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d"

const createWorkerClass = () => {
    const instances = []
    class FakeWorker {
        static RateLimitError() {
            return new Error("bullmq:rateLimitExceeded")
        }
        constructor(name, processor, options) {
            Object.assign(this, { name, processor, options, handlers: {}, rateLimited: [], closed: false })
            instances.push(this)
        }
        on(event, handler) {
            this.handlers[event] = handler
        }
        async waitUntilReady() {}
        async rateLimit(ms) {
            this.rateLimited.push(ms)
        }
        async close() {
            this.closed = true
        }
    }
    return { FakeWorker, instances }
}

const createRedis = () => {
    const hashes = new Map([[campaignKey(CAMPAIGN_ID), { subject: "s", failed: "0" }]])
    const lists = new Map()
    return {
        hashes,
        lists,
        exists: async key => (hashes.has(key) ? 1 : 0),
        multi: () => {
            const ops = []
            const chain = {
                hincrby: (key, field, by) => (ops.push(() => (hashes.get(key)[field] = String(Number(hashes.get(key)[field]) + by))), chain),
                rpush: (key, value) => (ops.push(() => lists.set(key, [...(lists.get(key) || []), value])), chain),
                ltrim: () => chain,
                expire: () => chain,
                exec: async () => ops.map(op => op()),
            }
            return chain
        },
        quit: async () => {},
    }
}

const logger = { info: () => {}, error: () => {} }
const start = async (processorFactory = () => async () => {}) => {
    const { FakeWorker, instances } = createWorkerClass()
    const redis = createRedis()
    const runtime = await startBulkEmailWorker({ WorkerClass: FakeWorker, connection: redis, processorFactory, logger })
    return { worker: instances[0], redis, runtime }
}

describe("startBulkEmailWorker", () => {
    it("sends 10 emails per second, one every 100 ms", async () => {
        const { worker } = await start()
        assert.equal(worker.name, BULK_EMAIL_QUEUE_NAME)
        assert.deepEqual(worker.options.limiter, { max: 1, duration: 100 })
        assert.equal(worker.options.concurrency, 10)
    })

    it("pauses the queue and keeps the attempt when SES throttles", async () => {
        let onThrottle
        const { worker } = await start(deps => {
            onThrottle = deps.onThrottle
            return async () => {}
        })
        await assert.rejects(onThrottle(), /rateLimitExceeded/)
        assert.deepEqual(worker.rateLimited, [2000])
    })

    it("counts an email as failed only after its last attempt", async () => {
        const { worker, redis } = await start()
        const job = attemptsMade => ({ id: "j", attemptsMade, opts: { attempts: 3 }, data: { campaignId: CAMPAIGN_ID, email: "a@x.mk" } })

        await worker.handlers.failed(job(1), new Error("x"))
        assert.equal(redis.hashes.get(campaignKey(CAMPAIGN_ID)).failed, "0")

        await worker.handlers.failed(job(3), new Error("x"))
        assert.equal(redis.hashes.get(campaignKey(CAMPAIGN_ID)).failed, "1")
        assert.deepEqual(redis.lists.get(`${campaignKey(CAMPAIGN_ID)}:failed`), ["a@x.mk"])
    })

    it("never logs a recipient address, even when the SES error message contains one", async () => {
        const lines = []
        const { FakeWorker, instances } = createWorkerClass()
        await startBulkEmailWorker({
            WorkerClass: FakeWorker,
            connection: createRedis(),
            processorFactory: () => async () => {},
            logger: { info: () => {}, error: (event, fields) => lines.push(JSON.stringify(fields)) },
        })
        const error = Object.assign(new Error("Email address is not verified: User@X.mk, other@y.com"), { name: "MessageRejected" })
        await instances[0].handlers.failed({ id: "j", attemptsMade: 1, opts: { attempts: 3 }, data: { campaignId: CAMPAIGN_ID, email: "user@x.mk" } }, error)

        assert.ok(lines.length > 0)
        assert.ok(lines.every(line => !/@/.test(line)), lines.join("\n"))
        assert.ok(lines[0].includes("MessageRejected"))
    })

    it("counts an unrecoverable error as failed right away", async () => {
        const { worker, redis } = await start()
        const error = Object.assign(new Error("bad"), { name: "UnrecoverableError" })
        await worker.handlers.failed({ id: "j", attemptsMade: 1, opts: { attempts: 3 }, data: { campaignId: CAMPAIGN_ID, email: "a@x.mk" } }, error)
        assert.equal(redis.hashes.get(campaignKey(CAMPAIGN_ID)).failed, "1")
    })

    it("closes the worker on shutdown", async () => {
        const { worker, runtime } = await start()
        await runtime.shutdown()
        assert.equal(worker.closed, true)
    })
})
