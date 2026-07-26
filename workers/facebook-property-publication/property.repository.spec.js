import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createPropertyRepository } from "./property.repository.js"

const connectionFields = [
    "id",
    "revision",
    "status",
    "pageId",
    "encryptedPageToken",
    "pageTokenExpiresAt",
    "dataAccessExpiresAt",
    "grantedScopes",
    "pageTasks",
]

describe("property repository", () => {
    test("loads all and only the property fields required for publication", async () => {
        let received
        const prisma = {
            property: {
                findUnique: async args => {
                    received = args
                    return null
                },
            },
        }

        await createPropertyRepository(prisma).loadProperty("property-1")

        assert.deepEqual(received.where, { id: "property-1" })
        assert.deepEqual(Object.keys(received.select).sort(), [
            "agency",
            "agencyId",
            "approximatePrice",
            "description",
            "district",
            "facebookPublishedAt",
            "hasApproximatePrice",
            "id",
            "listingType",
            "name",
            "photos",
            "price",
            "propertyLocation",
            "publishToFacebook",
            "size",
            "slug",
            "status",
        ])
        assert.deepEqual(
            Object.keys(received.select.agency.select.facebookConnection.select).sort(),
            connectionFields.sort()
        )
    })

    test("loads a compact final guard with every eligibility and connection-currentness field", async () => {
        let received
        const prisma = {
            property: {
                findUnique: async args => {
                    received = args
                    return null
                },
            },
        }

        await createPropertyRepository(prisma).loadPublicationGuard("property-1")

        assert.deepEqual(received.where, { id: "property-1" })
        assert.deepEqual(Object.keys(received.select).sort(), [
            "agency",
            "agencyId",
            "description",
            "facebookPublishedAt",
            "id",
            "listingType",
            "name",
            "photos",
            "publishToFacebook",
            "slug",
            "status",
        ])
        assert.deepEqual(
            Object.keys(received.select.agency.select.facebookConnection.select).sort(),
            connectionFields.sort()
        )
    })

    test("records a publication only while the timestamp is null", async () => {
        const calls = []
        const prisma = {
            property: {
                updateMany: async args => {
                    calls.push(args)
                    return { count: 1 }
                },
            },
        }
        const repository = createPropertyRepository(prisma)
        const publishedAt = new Date("2026-07-22T12:00:00.000Z")

        assert.deepEqual(await repository.recordPublished("property-1", publishedAt), { outcome: "recorded" })
        assert.deepEqual(calls[0].where, { id: "property-1", facebookPublishedAt: null })
        assert.deepEqual(calls[0].data, { facebookPublishedAt: publishedAt })
    })

    test("reports an existing publication timestamp after a conditional write loses a race", async () => {
        const prisma = {
            property: {
                updateMany: async () => ({ count: 0 }),
                findUnique: async () => ({ facebookPublishedAt: new Date("2026-07-22T12:00:00.000Z") }),
            },
        }

        assert.deepEqual(await createPropertyRepository(prisma).recordPublished("property-1", new Date()), {
            outcome: "already-recorded",
        })
    })

    test("reports deleted and still-unrecorded outcomes after a conditional write changes no row", async () => {
        const deletedPrisma = {
            property: {
                updateMany: async () => ({ count: 0 }),
                findUnique: async () => null,
            },
        }
        const unrecordedPrisma = {
            property: {
                updateMany: async () => ({ count: 0 }),
                findUnique: async () => ({ facebookPublishedAt: null }),
            },
        }

        assert.deepEqual(await createPropertyRepository(deletedPrisma).recordPublished("property-1", new Date()), {
            outcome: "deleted",
        })
        assert.deepEqual(await createPropertyRepository(unrecordedPrisma).recordPublished("property-1", new Date()), {
            outcome: "not-recorded",
        })
    })

    test("revision-guards connection invalidation", async () => {
        let received
        const prisma = {
            agencyFacebookConnection: {
                updateMany: async args => {
                    received = args
                    return { count: 1 }
                },
            },
        }
        const repository = createPropertyRepository(prisma)
        const errorAt = new Date("2026-07-22T12:00:00.000Z")

        await repository.invalidateConnection({
            connectionId: "connection-1",
            revision: 4,
            status: "ERROR",
            errorCode: "meta-200",
            errorAt,
        })

        assert.deepEqual(received.where, { id: "connection-1", revision: 4 })
        assert.deepEqual(received.data, { status: "ERROR", lastErrorCode: "meta-200", lastErrorAt: errorAt })
    })
})
