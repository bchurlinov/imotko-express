import assert from "node:assert/strict"
import { test } from "node:test"
import { createLogger } from "./logger.js"

test("logger emits only explicitly allowed structured fields", () => {
    const lines = []
    const logger = createLogger({ log: line => lines.push(line), error: line => lines.push(line) })

    logger.info("facebook_job_started", {
        jobId: "job-1",
        propertyId: "property-1",
        accessToken: "must-not-appear",
        description: "must-not-appear",
        imageUrl: "must-not-appear",
    })

    const parsed = JSON.parse(lines[0])
    assert.equal(parsed.level, "info")
    assert.equal(parsed.event, "facebook_job_started")
    assert.equal(parsed.jobId, "job-1")
    assert.equal(parsed.propertyId, "property-1")
    assert.equal(JSON.stringify(parsed).includes("must-not-appear"), false)
    assert.match(parsed.timestamp, /^\d{4}-\d{2}-\d{2}T/)
})

test("logger preserves completion and worker error metadata without unapproved fields", () => {
    const lines = []
    const logger = createLogger({ log: line => lines.push(line), error: line => lines.push(line) })

    logger.info("facebook_job_completed", { jobId: "job-1", jobName: "publish-approved-property", token: "secret" })
    logger.error("facebook_worker_error", { errorCode: "Error", cause: "must-not-appear" })

    assert.deepEqual(JSON.parse(lines[0]), {
        timestamp: JSON.parse(lines[0]).timestamp,
        level: "info",
        event: "facebook_job_completed",
        jobId: "job-1",
        jobName: "publish-approved-property",
    })
    assert.deepEqual(JSON.parse(lines[1]), {
        timestamp: JSON.parse(lines[1]).timestamp,
        level: "error",
        event: "facebook_worker_error",
        errorCode: "Error",
    })
})
