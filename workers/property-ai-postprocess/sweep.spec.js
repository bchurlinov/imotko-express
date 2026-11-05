import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createPropertyAiProcessor } from "./processor.js"
import { SWEEP_JOB_NAME, buildSweepWhere, runSweep, scheduleSweep } from "./sweep.js"

const NOW = new Date("2026-11-04T12:00:00Z")

const makeLogger = () => {
    const logs = []
    return {
        logs,
        info: (event, fields) => logs.push({ level: "info", event, fields }),
        error: (event, fields) => logs.push({ level: "error", event, fields }),
    }
}

describe("sweep", () => {
    test("job name is sweep", () => {
        assert.equal(SWEEP_JOB_NAME, "sweep")
    })

    test("where clause", () => {
        const where = buildSweepWhere(NOW)
        assert.equal(where.aiStatus, "PENDING")
        assert.equal(where.status, "PENDING")
        assert.deepEqual(where.updatedAt, {
            lt: new Date("2026-11-04T11:45:00Z"),
            gt: new Date("2026-10-28T12:00:00Z"),
        })
    })

    test("enqueues with the row's updatedAt, orderPhotos false, no facebookRevision", async () => {
        const rows = [
            { id: "p1", updatedAt: new Date("2026-11-04T10:00:00Z") },
            { id: "p2", updatedAt: new Date("2026-11-04T09:00:00Z") },
        ]
        const enqueued = []
        const count = await runSweep({
            findStuck: async () => rows,
            enqueue: async request => {
                enqueued.push(request)
            },
            now: NOW,
        })

        assert.equal(count, 2)
        assert.deepEqual(enqueued, [
            { propertyId: "p1", baselineUpdatedAt: rows[0].updatedAt.getTime(), orderPhotos: false },
            { propertyId: "p2", baselineUpdatedAt: rows[1].updatedAt.getTime(), orderPhotos: false },
        ])
        for (const request of enqueued) {
            assert.equal("facebookRevision" in request, false)
            assert.equal("userId" in request, false)
        }
    })

    test("one failed enqueue does not stop the rest, and the count is what was queued", async () => {
        const logger = makeLogger()
        const rows = ["p1", "p2", "p3"].map(id => ({ id, updatedAt: new Date("2026-11-04T10:00:00Z") }))
        const enqueued = []
        const count = await runSweep({
            findStuck: async () => rows,
            enqueue: async request => {
                if (request.propertyId === "p2") {
                    throw Object.assign(new Error("SECRET-MESSAGE"), { name: "ReplyError" })
                }
                enqueued.push(request.propertyId)
            },
            now: NOW,
            logger,
        })

        assert.equal(count, 2)
        assert.deepEqual(enqueued, ["p1", "p3"])
        const failure = logger.logs.find(entry => entry.event === "property_ai_sweep_enqueue_failed")
        assert.deepEqual(failure.fields, { propertyId: "p2", errorCode: "ReplyError" })
        assert.ok(!JSON.stringify(logger.logs).includes("SECRET-MESSAGE"))
    })

    test("logs only the count", async () => {
        const logger = makeLogger()
        await runSweep({
            findStuck: async () => [{ id: "p1", updatedAt: new Date("2026-11-04T10:00:00Z") }],
            enqueue: async () => {},
            now: NOW,
            logger,
        })
        assert.deepEqual(logger.logs, [{ level: "info", event: "property_ai_sweep_done", fields: { count: 1 } }])
    })

    test("findStuck is asked for at most 50 rows", async () => {
        const calls = []
        await runSweep({
            findStuck: async args => {
                calls.push(args)
                return []
            },
            enqueue: async () => {},
            now: NOW,
        })
        assert.deepEqual(calls, [{ where: buildSweepWhere(NOW), take: 50 }])
    })

    test("scheduleSweep upserts one repeatable scheduler every 15 minutes", async () => {
        const calls = []
        await scheduleSweep({
            upsertJobScheduler: async (...args) => {
                calls.push(args)
            },
        })
        assert.deepEqual(calls, [["property-ai-sweep", { every: 900000 }, { name: "sweep" }]])
    })

    test("processor routes a sweep job to sweep and never to enrichStored", async () => {
        const calls = []
        const record = name => async () => {
            calls.push(name)
        }
        const processor = createPropertyAiProcessor({
            loadProperty: record("loadProperty"),
            enrichStored: record("enrichStored"),
            orderPhotos: record("orderPhotos"),
            writeIfUnchanged: record("writeIfUnchanged"),
            toFailurePatch: () => ({}),
            revalidate: record("revalidate"),
            notifyTemplates: record("notifyTemplates"),
            enqueueFacebook: record("enqueueFacebook"),
            sweep: record("sweep"),
            logger: makeLogger(),
        })

        await processor({ id: "sweep-1", name: SWEEP_JOB_NAME, attemptsMade: 0, opts: { attempts: 5 }, data: {} })
        assert.deepEqual(calls, ["sweep"])
    })
})
