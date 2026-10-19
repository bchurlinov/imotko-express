import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { PROPERTY_REPORT_REASONS, reportProperty } from "./property_report.service.js"

const originals = {
    propertyFindUnique: prisma.property.findUnique,
    reportFindFirst: prisma.propertyReport.findFirst,
    reportCreate: prisma.propertyReport.create,
    reportUpdate: prisma.propertyReport.update,
}

afterEach(() => {
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.propertyReport.findFirst = originals.reportFindFirst
    prisma.propertyReport.create = originals.reportCreate
    prisma.propertyReport.update = originals.reportUpdate
})

const stubProperty = property => {
    prisma.property.findUnique = async () => property
}

test("reasons map lowercase wire codes to enum values", () => {
    assert.deepEqual(Object.keys(PROPERTY_REPORT_REASONS), [
        "scam",
        "misleading",
        "unavailable",
        "duplicate",
        "inappropriate",
        "other",
    ])
    assert.equal(PROPERTY_REPORT_REASONS.scam, "SCAM")
})

test("creates a report with a trimmed message", async () => {
    stubProperty({ id: "p1", status: "PUBLISHED", client: { userId: "seller" } })
    prisma.propertyReport.findFirst = async () => null
    let created
    prisma.propertyReport.create = async ({ data }) => {
        created = data
        return { id: "r1" }
    }

    const result = await reportProperty({ propertyId: "p1", reporterUserId: "u1", reason: "scam", message: "  fake  " })

    assert.deepEqual(result, { id: "r1", reason: "scam", updated: false })
    assert.deepEqual(created, { reason: "SCAM", message: "fake", propertyId: "p1", reporterUserId: "u1" })
})

test("an empty message is stored as null and long ones are capped", async () => {
    stubProperty({ id: "p1", status: "PUBLISHED", client: null })
    prisma.propertyReport.findFirst = async () => null
    const messages = []
    prisma.propertyReport.create = async ({ data }) => {
        messages.push(data.message)
        return { id: "r1" }
    }

    await reportProperty({ propertyId: "p1", reporterUserId: "u1", reason: "other", message: "   " })
    await reportProperty({ propertyId: "p1", reporterUserId: "u1", reason: "other", message: "x".repeat(900) })

    assert.equal(messages[0], null)
    assert.equal(messages[1].length, 500)
})

test("a second open report from the same user updates the first", async () => {
    stubProperty({ id: "p1", status: "PUBLISHED", client: null })
    prisma.propertyReport.findFirst = async ({ where }) => {
        assert.deepEqual(where, { propertyId: "p1", reporterUserId: "u1", resolvedAt: null })
        return { id: "r1" }
    }
    prisma.propertyReport.create = async () => assert.fail("must not create a duplicate")
    let updated
    prisma.propertyReport.update = async args => {
        updated = args
        return { id: "r1" }
    }

    const result = await reportProperty({ propertyId: "p1", reporterUserId: "u1", reason: "duplicate" })

    assert.equal(result.updated, true)
    assert.deepEqual(updated.where, { id: "r1" })
    assert.deepEqual(updated.data, { reason: "DUPLICATE", message: null })
})

test("the seller cannot report their own listing", async () => {
    stubProperty({ id: "p1", status: "PUBLISHED", client: { userId: "u1" } })

    await assert.rejects(reportProperty({ propertyId: "p1", reporterUserId: "u1", reason: "scam" }), {
        code: "cannotReportOwnListing",
        status: 403,
    })
})

test("a missing or deleted listing is not found", async () => {
    stubProperty(null)
    await assert.rejects(reportProperty({ propertyId: "nope", reporterUserId: "u1", reason: "scam" }), {
        code: "propertyNotFound",
        status: 404,
    })

    stubProperty({ id: "p1", status: "DELETED", client: null })
    await assert.rejects(reportProperty({ propertyId: "p1", reporterUserId: "u1", reason: "scam" }), {
        code: "propertyNotFound",
        status: 404,
    })
})
