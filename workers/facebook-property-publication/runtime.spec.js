import assert from "node:assert/strict"
import { test } from "node:test"
import { createLogger } from "./logger.js"
import { startFacebookWorker } from "./runtime.js"

const createFakeWorkerClass = events => {
    class FakeWorker {
        static instances = []

        constructor(...args) {
            this.args = args
            this.handlers = new Map()
            FakeWorker.instances.push(this)
        }

        on(event, handler) {
            this.handlers.set(event, handler)
            return this
        }

        async waitUntilReady() {
            events.push("ready")
        }

        async close() {
            events.push("worker.close")
        }

        emit(event, ...args) {
            this.handlers.get(event)?.(...args)
        }
    }

    return FakeWorker
}

test("starts the exact Facebook queue, reports lifecycle events, and shuts down once in order", async () => {
    const lifecycle = []
    const WorkerClass = createFakeWorkerClass(lifecycle)
    const connection = { quit: async () => lifecycle.push("redis.quit") }
    const processor = async () => {}
    const logLines = []
    const logger = createLogger({ log: line => logLines.push(line), error: line => logLines.push(line) })

    const runtime = await startFacebookWorker({ WorkerClass, connection, processor, logger })
    const worker = WorkerClass.instances[0]
    assert.deepEqual(worker.args, [
        "facebook-property-publication",
        processor,
        { connection, concurrency: 1, drainDelay: 50, stalledInterval: 300_000 },
    ])
    assert.deepEqual(lifecycle, ["ready"])

    worker.emit("completed", { id: "job-1", name: "publish-approved-property" })
    worker.emit(
        "failed",
        {
            id: "job-2",
            name: "publish-approved-property",
            attemptsMade: 2,
            data: { propertyId: "property-1", agencyId: "agency-1" },
        },
        {
            name: "FacebookApiError",
            metaCode: 190,
            metaSubcode: 463,
            fbtraceId: "trace-1",
            accessToken: "must-not-appear",
        }
    )
    worker.emit("error", new Error("Redis unavailable"))

    const events = logLines.map(JSON.parse)
    assert.deepEqual(
        events.map(event => event.event),
        ["facebook_worker_started", "facebook_job_completed", "facebook_job_failed", "facebook_worker_error"]
    )
    assert.deepEqual(events[2], {
        timestamp: events[2].timestamp,
        level: "error",
        event: "facebook_job_failed",
        jobId: "job-2",
        jobName: "publish-approved-property",
        propertyId: "property-1",
        agencyId: "agency-1",
        attempt: 2,
        errorCode: "FacebookApiError",
        metaCode: 190,
        metaSubcode: 463,
        fbtraceId: "trace-1",
    })
    assert.equal(JSON.stringify(events[2]).includes("must-not-appear"), false)

    await runtime.shutdown()
    await runtime.shutdown()

    assert.deepEqual(lifecycle, ["ready", "worker.close", "redis.quit"])
    assert.deepEqual(logLines.map(line => JSON.parse(line).event).slice(-2), [
        "facebook_worker_stopping",
        "facebook_worker_stopped",
    ])
})

test("attempts every cleanup operation and rejects with the first shutdown failure", async () => {
    const lifecycle = []
    const firstError = new Error("worker close failed")
    const secondError = new Error("redis quit failed")
    const WorkerClass = createFakeWorkerClass(lifecycle)
    WorkerClass.prototype.close = async function () {
        lifecycle.push("worker.close")
        throw firstError
    }
    const connection = {
        quit: async () => {
            lifecycle.push("redis.quit")
            throw secondError
        },
    }
    const logger = { info: () => {}, error: () => {} }

    const runtime = await startFacebookWorker({ WorkerClass, connection, processor: async () => {}, logger })
    await assert.rejects(runtime.shutdown(), error => error === firstError)
    assert.deepEqual(lifecycle, ["ready", "worker.close", "redis.quit"])
})

test("closes a constructed worker when readiness fails without owning Redis or Prisma cleanup", async () => {
    const lifecycle = []
    const readinessError = new Error("Redis is unavailable")
    const WorkerClass = createFakeWorkerClass(lifecycle)
    WorkerClass.prototype.waitUntilReady = async function () {
        lifecycle.push("ready")
        throw readinessError
    }
    const connection = { quit: async () => lifecycle.push("redis.quit") }

    await assert.rejects(
        startFacebookWorker({
            WorkerClass,
            connection,
            processor: async () => {},
            logger: { info: () => {}, error: () => {} },
        }),
        error => error === readinessError
    )
    assert.deepEqual(lifecycle, ["ready", "worker.close"])
})

test("preserves the readiness error when worker cleanup also fails", async () => {
    const lifecycle = []
    const readinessError = new Error("Redis is unavailable")
    const WorkerClass = createFakeWorkerClass(lifecycle)
    WorkerClass.prototype.waitUntilReady = async function () {
        lifecycle.push("ready")
        throw readinessError
    }
    WorkerClass.prototype.close = function () {
        lifecycle.push("worker.close")
        throw new Error("worker close failed")
    }

    await assert.rejects(
        startFacebookWorker({
            WorkerClass,
            connection: { quit: async () => assert.fail("runtime must not quit Redis") },
            processor: async () => {},
            logger: { info: () => {}, error: () => {} },
        }),
        error => error === readinessError
    )
    assert.deepEqual(lifecycle, ["ready", "worker.close"])
})

test("logs BullMQ's already-incremented first and final failed attempt counts", async () => {
    const lifecycle = []
    const WorkerClass = createFakeWorkerClass(lifecycle)
    const lines = []
    const runtime = await startFacebookWorker({
        WorkerClass,
        connection: { quit: async () => {} },
        processor: async () => {},
        logger: createLogger({ log: line => lines.push(line), error: line => lines.push(line) }),
    })

    runtime.worker.emit("failed", { id: "job-1", name: "publish-approved-property", attemptsMade: 1 }, new Error())
    runtime.worker.emit("failed", { id: "job-5", name: "publish-approved-property", attemptsMade: 5 }, new Error())

    assert.deepEqual(
        lines
            .map(JSON.parse)
            .filter(event => event.event === "facebook_job_failed")
            .map(event => event.attempt),
        [1, 5]
    )
})
