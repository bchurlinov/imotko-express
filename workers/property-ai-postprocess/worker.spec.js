import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { startPropertyAiWorker } from "./worker.js"

const env = {
    DATABASE_URL: "postgresql://localhost/imotko",
    UPSTASH_REDIS_URL: "rediss://default:secret@redis.example.com:6379",
    OPENAI_API_KEY: "sk-test",
    INTERNAL_API_SECRET: "internal-secret",
    IMOTKO_WEB_URL: "https://imotko.mk",
    REVALIDATE_SECRET: "revalidate-secret",
}

const setup = ({ readyError, closeError, scheduleError } = {}) => {
    const events = []
    const schedulerCalls = []
    const fakeQueue = {
        upsertJobScheduler: async (...args) => {
            schedulerCalls.push(args)
            if (scheduleError) throw scheduleError
        },
    }
    const logs = []
    const handlers = {}
    const connection = {
        on: (name, handler) => {
            handlers[`connection:${name}`] = handler
        },
        quit: async () => {
            events.push("connection.quit")
        },
    }
    const connectionUrls = []
    class FakeWorker {
        constructor(name, processor, options) {
            this.name = name
            this.processor = processor
            this.options = options
            FakeWorker.instance = this
        }
        on(name, handler) {
            handlers[name] = handler
        }
        async waitUntilReady() {
            if (readyError) throw readyError
        }
        async close() {
            events.push("worker.close")
        }
    }
    const logger = {
        info: (event, fields) => logs.push({ event, fields }),
        error: (event, fields) => logs.push({ event, fields }),
    }
    const start = () =>
        startPropertyAiWorker({
            logger,
            env,
            WorkerClass: FakeWorker,
            createConnection: url => {
                connectionUrls.push(url)
                return connection
            },
            getQueue: () => fakeQueue,
            closeQueues: async () => {
                events.push("queues.close")
                if (closeError) throw closeError
            },
        })
    return { start, events, logs, handlers, connectionUrls, FakeWorker, connection, schedulerCalls }
}

describe("startPropertyAiWorker", () => {
    test("starts a worker on the property AI queue with the low-polling options and concurrency 2", async () => {
        const { start, FakeWorker, connectionUrls, connection } = setup()
        await start()

        assert.equal(FakeWorker.instance.name, "property-ai-postprocess")
        assert.equal(typeof FakeWorker.instance.processor, "function")
        assert.deepEqual(FakeWorker.instance.options, {
            connection,
            concurrency: 2,
            drainDelay: 50,
            stalledInterval: 300_000,
        })
        assert.deepEqual(connectionUrls, [env.UPSTASH_REDIS_URL])
    })

    test("registers the repeatable sweep once the worker is ready", async () => {
        const { start, schedulerCalls } = setup()
        await start()
        assert.deepEqual(schedulerCalls, [["property-ai-sweep", { every: 900000 }, { name: "sweep" }]])
    })

    test("a failed sweep registration is logged by name and does not stop the worker", async () => {
        const scheduleError = Object.assign(new Error("SECRET-MESSAGE"), { name: "ReplyError" })
        const { start, logs } = setup({ scheduleError })
        const runtime = await start()

        assert.equal(typeof runtime.shutdown, "function")
        const failure = logs.find(entry => entry.event === "property_ai_sweep_schedule_failed")
        assert.deepEqual(failure.fields, { errorCode: "ReplyError" })
        assert.ok(!JSON.stringify(logs).includes("SECRET-MESSAGE"))
    })

    test("a missing environment variable fails before a connection is opened", async () => {
        const { connectionUrls, FakeWorker, events } = setup()
        await assert.rejects(
            startPropertyAiWorker({
                logger: { info() {}, error() {} },
                env: { ...env, IMOTKO_WEB_URL: "" },
                WorkerClass: FakeWorker,
                createConnection: url => connectionUrls.push(url),
            }),
            /IMOTKO_WEB_URL is required/
        )
        assert.deepEqual(connectionUrls, [])
        assert.deepEqual(events, [])
    })

    test("logs completed and failed jobs by id, attempt, name and status only", async () => {
        const { start, handlers, logs } = setup()
        await start()

        handlers.completed({ id: "j1", name: "process" })
        const error = Object.assign(new Error("SECRET-MESSAGE"), {
            name: "APICallError",
            statusCode: 429,
            requestBodyValues: { input: "SECRET-TEXT" },
        })
        handlers.failed(
            { id: "j1", name: "process", attemptsMade: 3, data: { propertyId: "p1", agencyId: "SECRET-AGENCY" } },
            error
        )
        handlers.error(Object.assign(new Error("NOAUTH SECRET-REPLY"), { name: "TypeError" }))

        const serialized = JSON.stringify(logs)
        for (const secret of ["SECRET-MESSAGE", "SECRET-TEXT", "NOAUTH"]) {
            assert.ok(!serialized.includes(secret), `${secret} leaked`)
        }
        const failed = logs.find(entry => entry.event === "property_ai_job_failed")
        assert.deepEqual(failed.fields, {
            jobId: "j1",
            jobName: "process",
            propertyId: "p1",
            attempt: 3,
            errorCode: "APICallError",
            status: 429,
        })
        assert.ok(logs.some(entry => entry.event === "property_ai_job_completed"))
        assert.ok(logs.some(entry => entry.event === "property_ai_worker_error"))
    })

    test("redis connection errors are logged, not thrown", async () => {
        const { start, handlers, logs } = setup()
        await start()
        handlers["connection:error"](Object.assign(new Error("boom"), { name: "Error" }))
        assert.ok(logs.some(entry => entry.event === "property_ai_redis_error"))
    })

    test("shutdown closes the worker, its connection, then both queues, and is idempotent", async () => {
        const { start, events } = setup()
        const runtime = await start()

        await runtime.shutdown()
        await runtime.shutdown()
        assert.deepEqual(events, ["worker.close", "connection.quit", "queues.close"])
    })

    test("shutdown still closes everything and rethrows the first error", async () => {
        const closeError = new Error("queue close failed")
        const { start, events } = setup({ closeError })
        const runtime = await start()
        await assert.rejects(runtime.shutdown(), err => err === closeError)
        assert.deepEqual(events, ["worker.close", "connection.quit", "queues.close"])
    })

    test("a failed readiness check closes the worker and the connection and rethrows", async () => {
        const readyError = new Error("redis unreachable")
        const { start, events } = setup({ readyError })
        await assert.rejects(start(), err => err === readyError)
        assert.deepEqual(events, ["worker.close", "connection.quit"])
    })
})
