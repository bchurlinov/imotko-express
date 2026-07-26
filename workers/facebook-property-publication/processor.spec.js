import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { UnrecoverableError } from "bullmq"
import { FacebookApiError, MetaCryptoError, RetryablePublicationError } from "./errors.js"
import { createFacebookPropertyProcessor } from "./processor.js"

const checkedAt = new Date("2026-07-22T12:00:00.000Z")
const future = new Date("2030-01-01T00:00:00.000Z")

const makeProperty = (overrides = {}) => ({
    id: "property-1",
    agencyId: "agency-1",
    status: "PUBLISHED",
    publishToFacebook: true,
    facebookPublishedAt: null,
    slug: "stan",
    name: { mk: "Стан" },
    description: { mk: "<p>Опис</p>" },
    photos: [
        { sizes: { large: "https://images.example/1.jpg" } },
        { sizes: { large: "https://images.example/2.jpg" } },
    ],
    listingType: "for_sale",
    price: 100000,
    hasApproximatePrice: false,
    approximatePrice: null,
    size: 80,
    district: "Центар",
    propertyLocation: { name: "Скопје" },
    agency: {
        facebookConnection: {
            id: "connection-1",
            revision: 3,
            status: "CONNECTED",
            pageId: "page-1",
            encryptedPageToken: "encrypted-token-secret",
            pageTokenExpiresAt: future,
            dataAccessExpiresAt: future,
            grantedScopes: ["pages_manage_posts", "pages_read_engagement"],
            pageTasks: ["CREATE_CONTENT"],
        },
    },
    ...overrides,
})

const makeJob = (overrides = {}) => ({
    id: "facebook-property-property-1",
    name: "publish-approved-property",
    data: { propertyId: "property-1", agencyId: "agency-1" },
    attemptsMade: 0,
    ...overrides,
})

function createHarness({
    property = makeProperty(),
    guard = property,
    decryptImpl = () => "page-token-secret",
    uploadImpl = async ({ imageUrl }) => (imageUrl.endsWith("1.jpg") ? "photo-1" : "photo-2"),
    postImpl = async () => "page-1_post-1",
    recordImpl = async () => ({ outcome: "recorded" }),
    loadImpl = async () => property,
    guardImpl = async () => guard,
    invalidateImpl = async () => ({ count: 1 }),
    logImpl = () => {},
    now = () => checkedAt,
} = {}) {
    const events = []
    const calls = {
        loadProperty: 0,
        loadPublicationGuard: 0,
        decryptToken: 0,
        uploadUnpublishedPhoto: 0,
        createPagePost: 0,
        recordPublished: 0,
        invalidateConnection: 0,
    }
    const logs = []

    const repository = {
        async loadProperty(propertyId) {
            calls.loadProperty += 1
            events.push(["load", propertyId])
            return loadImpl(propertyId)
        },
        async loadPublicationGuard(propertyId) {
            calls.loadPublicationGuard += 1
            events.push(["guard", propertyId])
            return guardImpl(propertyId)
        },
        async recordPublished(propertyId, publishedAt) {
            calls.recordPublished += 1
            events.push(["record", propertyId, publishedAt])
            return recordImpl(propertyId, publishedAt)
        },
        async invalidateConnection(input) {
            calls.invalidateConnection += 1
            events.push(["invalidate", input])
            return invalidateImpl(input)
        },
    }
    const facebookClient = {
        async uploadUnpublishedPhoto(input) {
            calls.uploadUnpublishedPhoto += 1
            events.push(["upload", input])
            return uploadImpl(input)
        },
        async createPagePost(input) {
            calls.createPagePost += 1
            events.push(["post", input])
            return postImpl(input)
        },
    }
    const processor = createFacebookPropertyProcessor({
        repository,
        facebookClient,
        decryptToken(envelope, key) {
            calls.decryptToken += 1
            events.push(["decrypt"])
            return decryptImpl(envelope, key)
        },
        tokenEncryptionKey: "encryption-key-secret",
        publicAppUrl: "https://imotko.mk",
        now,
        logger: {
            info: (event, metadata) => {
                logs.push(["info", event, metadata])
                logImpl("info", event, metadata)
            },
            error: (event, metadata) => {
                logs.push(["error", event, metadata])
                logImpl("error", event, metadata)
            },
        },
    })

    return { calls, events, logs, processor }
}

const assertUnrecoverable = error => error instanceof UnrecoverableError

describe("Facebook property processor", () => {
    test("uploads ordered photos, reloads the final guard, posts once, then records publication", async () => {
        const harness = createHarness()

        assert.deepEqual(await harness.processor(makeJob()), {
            published: true,
            propertyId: "property-1",
            facebookPostId: "page-1_post-1",
        })
        assert.deepEqual(
            harness.events.map(([event]) => event),
            ["load", "decrypt", "upload", "upload", "guard", "post", "record"]
        )
        assert.deepEqual(
            harness.events.filter(([event]) => event === "upload").map(([, input]) => input),
            [
                {
                    pageId: "page-1",
                    imageUrl: "https://images.example/1.jpg",
                    accessToken: "page-token-secret",
                },
                {
                    pageId: "page-1",
                    imageUrl: "https://images.example/2.jpg",
                    accessToken: "page-token-secret",
                },
            ]
        )
        const postInput = harness.events.find(([event]) => event === "post")[1]
        assert.deepEqual(postInput.photoIds, ["photo-1", "photo-2"])
        assert.equal(postInput.pageId, "page-1")
        assert.equal(postInput.accessToken, "page-token-secret")
        assert.match(postInput.message, /Стан/)
        assert.deepEqual(harness.events.at(-1), ["record", "property-1", checkedAt])
    })

    test("waits for each photo upload before starting the next one", async () => {
        let markFirstStarted
        let releaseFirst
        const firstStarted = new Promise(resolve => {
            markFirstStarted = resolve
        })
        const firstUploadMayFinish = new Promise(resolve => {
            releaseFirst = resolve
        })
        const harness = createHarness({
            uploadImpl: async ({ imageUrl }) => {
                if (imageUrl.endsWith("1.jpg")) {
                    markFirstStarted()
                    await firstUploadMayFinish
                    return "photo-1"
                }
                return "photo-2"
            },
        })

        const processing = harness.processor(makeJob())
        await firstStarted
        assert.equal(harness.calls.uploadUnpublishedPhoto, 1)
        assert.equal(harness.calls.loadPublicationGuard, 0)

        releaseFirst()
        await processing
        assert.equal(harness.calls.uploadUnpublishedPhoto, 2)
        assert.equal(harness.calls.loadPublicationGuard, 1)
    })

    test("skips an already-published property before decrypting or calling Facebook", async () => {
        const property = makeProperty({ facebookPublishedAt: new Date("2026-07-22T11:00:00.000Z") })
        const harness = createHarness({ property })

        assert.deepEqual(await harness.processor(makeJob()), {
            skipped: true,
            reason: "already-published",
            propertyId: "property-1",
        })
        assert.equal(harness.calls.decryptToken, 0)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 0)
        assert.equal(harness.calls.createPagePost, 0)
        assert.equal(harness.calls.loadPublicationGuard, 0)
        assert.equal(harness.calls.recordPublished, 0)
    })

    test("skips HTML that converts to empty content before decrypting or calling Facebook", async () => {
        const property = makeProperty({ description: { mk: "<div><br></div>" } })
        const harness = createHarness({ property })

        assert.deepEqual(await harness.processor(makeJob()), {
            skipped: true,
            reason: "invalid-facebook-content",
            propertyId: "property-1",
        })
        assert.equal(harness.calls.decryptToken, 0)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 0)
        assert.equal(harness.calls.createPagePost, 0)
        assert.equal(harness.calls.loadPublicationGuard, 0)
        assert.equal(harness.calls.recordPublished, 0)
    })

    test("stops at the first failed photo upload and leaves the failure retryable", async () => {
        const uploadError = new RetryablePublicationError("temporary upload failure", { errorCode: "network" })
        const harness = createHarness({
            uploadImpl: async () => {
                throw uploadError
            },
        })

        await assert.rejects(harness.processor(makeJob()), error => error === uploadError)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 1)
        assert.equal(harness.calls.loadPublicationGuard, 0)
        assert.equal(harness.calls.createPagePost, 0)
        assert.equal(harness.calls.recordPublished, 0)
        assert.equal(harness.calls.invalidateConnection, 0)
    })

    test("skips after uploads when the final guard observes withdrawn consent", async () => {
        const property = makeProperty()
        const harness = createHarness({ guard: { ...property, publishToFacebook: false } })

        assert.deepEqual(await harness.processor(makeJob()), {
            skipped: true,
            reason: "publication-guard-changed",
            propertyId: "property-1",
        })
        assert.equal(harness.calls.uploadUnpublishedPhoto, 2)
        assert.equal(harness.calls.loadPublicationGuard, 1)
        assert.equal(harness.calls.createPagePost, 0)
        assert.equal(harness.calls.recordPublished, 0)
        assert.deepEqual(
            harness.events.map(([event]) => event),
            ["load", "decrypt", "upload", "upload", "guard"]
        )
    })

    test("invalidates the original connection revision and stops retries on permanent Facebook failure", async () => {
        const apiError = new FacebookApiError("expired", {
            connectionStatus: "EXPIRED",
            errorCode: "meta-190",
            metaCode: 190,
            metaSubcode: 463,
            fbtraceId: "trace-1",
        })
        const harness = createHarness({
            uploadImpl: async () => {
                throw apiError
            },
        })

        await assert.rejects(harness.processor(makeJob()), assertUnrecoverable)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 1)
        assert.equal(harness.calls.createPagePost, 0)
        assert.equal(harness.calls.recordPublished, 0)
        assert.equal(harness.calls.invalidateConnection, 1)
        assert.deepEqual(harness.events.at(-1), [
            "invalidate",
            {
                connectionId: "connection-1",
                revision: 3,
                status: "EXPIRED",
                errorCode: "meta-190",
                errorAt: checkedAt,
            },
        ])
    })

    test("invalidates a connection and stops retries when its stored token cannot be decrypted", async () => {
        const harness = createHarness({
            decryptImpl: () => {
                throw new MetaCryptoError("Cannot decrypt Facebook Page token")
            },
        })

        await assert.rejects(harness.processor(makeJob()), assertUnrecoverable)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 0)
        assert.equal(harness.calls.createPagePost, 0)
        assert.equal(harness.calls.recordPublished, 0)
        assert.deepEqual(harness.events.at(-1), [
            "invalidate",
            {
                connectionId: "connection-1",
                revision: 3,
                status: "ERROR",
                errorCode: "token-decryption-failed",
                errorAt: checkedAt,
            },
        ])
    })

    test("invalidates stored permission loss and completes with a permanent skip", async () => {
        const property = makeProperty({
            agency: {
                facebookConnection: {
                    ...makeProperty().agency.facebookConnection,
                    grantedScopes: ["pages_read_engagement"],
                },
            },
        })
        const harness = createHarness({ property })

        assert.deepEqual(await harness.processor(makeJob()), {
            skipped: true,
            reason: "missing-page-scope",
            propertyId: "property-1",
        })
        assert.deepEqual(harness.events.at(-1), [
            "invalidate",
            {
                connectionId: "connection-1",
                revision: 3,
                status: "ERROR",
                errorCode: "missing-page-scope",
                errorAt: checkedAt,
            },
        ])
        assert.equal(harness.calls.decryptToken, 0)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 0)
        assert.equal(harness.calls.createPagePost, 0)
    })

    for (const persistenceOutcome of ["already-recorded", "deleted"]) {
        test(`accepts ${persistenceOutcome} persistence after Facebook confirmed the post`, async () => {
            const harness = createHarness({ recordImpl: async () => ({ outcome: persistenceOutcome }) })

            assert.deepEqual(await harness.processor(makeJob()), {
                published: true,
                propertyId: "property-1",
                facebookPostId: "page-1_post-1",
            })
            assert.equal(harness.calls.createPagePost, 1)
            assert.equal(harness.calls.recordPublished, 1)
            const publishedLog = harness.logs.find(([, event]) => event === "facebook_post_published")
            assert.equal(publishedLog[2].persistenceOutcome, persistenceOutcome)
        })
    }

    test("emits a critical sanitized event when a confirmed post can no longer be tracked", async () => {
        const harness = createHarness({ recordImpl: async () => ({ outcome: "deleted" }) })

        assert.deepEqual(await harness.processor(makeJob()), {
            published: true,
            propertyId: "property-1",
            facebookPostId: "page-1_post-1",
        })
        assert.deepEqual(
            harness.logs.find(([level, event]) => level === "error" && event === "published-untracked"),
            [
                "error",
                "published-untracked",
                {
                    jobId: "facebook-property-property-1",
                    propertyId: "property-1",
                    agencyId: "agency-1",
                    facebookPostId: "page-1_post-1",
                    persistenceOutcome: "deleted",
                },
            ]
        )
        assert.equal(
            harness.logs.some(([, event]) => event === "facebook_post_published"),
            true
        )
        assert.equal(harness.calls.createPagePost, 1)
        assert.equal(harness.calls.recordPublished, 1)
    })

    test("does not retry a confirmed post when success logging fails", async () => {
        const harness = createHarness({
            recordImpl: async () => ({ outcome: "deleted" }),
            logImpl: (_level, event) => {
                if (event === "facebook_post_published") throw new Error("logger unavailable")
            },
        })

        assert.deepEqual(await harness.processor(makeJob()), {
            published: true,
            propertyId: "property-1",
            facebookPostId: "page-1_post-1",
        })
        assert.equal(harness.calls.createPagePost, 1)
        assert.equal(harness.calls.recordPublished, 1)
    })

    test("retries a still-unrecorded persistence outcome after Facebook confirmed the post", async () => {
        const harness = createHarness({ recordImpl: async () => ({ outcome: "not-recorded" }) })

        await assert.rejects(harness.processor(makeJob()), error => {
            assert.equal(error instanceof UnrecoverableError, false)
            assert.match(error.message, /timestamp was not recorded/)
            return true
        })
        assert.equal(harness.calls.createPagePost, 1)
        assert.equal(harness.calls.recordPublished, 1)
    })

    test("propagates retryable Facebook and database failures without invalidating the connection", async () => {
        const apiError = new RetryablePublicationError("rate limited", { errorCode: "meta-4" })
        const facebookHarness = createHarness({
            postImpl: async () => {
                throw apiError
            },
        })
        await assert.rejects(facebookHarness.processor(makeJob()), error => error === apiError)
        assert.equal(facebookHarness.calls.invalidateConnection, 0)
        assert.equal(facebookHarness.calls.recordPublished, 0)

        const databaseError = new Error("database unavailable")
        const databaseHarness = createHarness({
            loadImpl: async () => {
                throw databaseError
            },
        })
        await assert.rejects(databaseHarness.processor(makeJob()), error => error === databaseError)
        assert.equal(databaseHarness.calls.decryptToken, 0)
        assert.equal(databaseHarness.calls.uploadUnpublishedPhoto, 0)
    })

    test("keeps connection-invalidation and publication-persistence database failures retryable", async () => {
        const invalidationDatabaseError = new Error("connection update unavailable")
        const permanentApiError = new FacebookApiError("permission lost", {
            connectionStatus: "ERROR",
            errorCode: "meta-200",
        })
        const invalidationHarness = createHarness({
            uploadImpl: async () => {
                throw permanentApiError
            },
            invalidateImpl: async () => {
                throw invalidationDatabaseError
            },
        })

        await assert.rejects(invalidationHarness.processor(makeJob()), error => error === invalidationDatabaseError)
        assert.equal(invalidationHarness.calls.invalidateConnection, 1)
        assert.equal(invalidationHarness.calls.createPagePost, 0)

        const persistenceDatabaseError = new Error("publication update unavailable")
        const persistenceHarness = createHarness({
            recordImpl: async () => {
                throw persistenceDatabaseError
            },
        })

        await assert.rejects(persistenceHarness.processor(makeJob()), error => error === persistenceDatabaseError)
        assert.equal(persistenceHarness.calls.createPagePost, 1)
        assert.equal(persistenceHarness.calls.recordPublished, 1)
    })

    test("keeps sensitive token, description, and image URL values out of every log call", async () => {
        const property = makeProperty({
            description: { mk: "<p>description-secret-marker</p>" },
            photos: [{ sizes: { large: "https://images.example/image-secret-marker.jpg" } }],
        })
        const harness = createHarness({ property })

        await harness.processor(makeJob())

        const serializedLogs = JSON.stringify(harness.logs)
        for (const secret of [
            "encrypted-token-secret",
            "page-token-secret",
            "encryption-key-secret",
            "description-secret-marker",
            "image-secret-marker",
        ]) {
            assert.equal(serializedLogs.includes(secret), false, `logs exposed ${secret}`)
        }
    })

    test("rejects an unknown job name before database access", async () => {
        const harness = createHarness()

        await assert.rejects(harness.processor(makeJob({ name: "unknown-job" })), assertUnrecoverable)
        assert.equal(harness.calls.loadProperty, 0)
        assert.equal(harness.calls.decryptToken, 0)
        assert.equal(harness.calls.uploadUnpublishedPhoto, 0)
    })

    for (const [label, data] of [
        ["missing data", undefined],
        ["empty property ID", { propertyId: "", agencyId: "agency-1" }],
        ["whitespace property ID", { propertyId: "   ", agencyId: "agency-1" }],
        ["non-string property ID", { propertyId: 123, agencyId: "agency-1" }],
        ["empty agency ID", { propertyId: "property-1", agencyId: "" }],
        ["whitespace agency ID", { propertyId: "property-1", agencyId: "\t" }],
        ["non-string agency ID", { propertyId: "property-1", agencyId: null }],
    ]) {
        test(`rejects ${label} before database access`, async () => {
            const harness = createHarness()

            await assert.rejects(harness.processor(makeJob({ data })), assertUnrecoverable)
            assert.equal(harness.calls.loadProperty, 0)
            assert.equal(harness.calls.decryptToken, 0)
            assert.equal(harness.calls.uploadUnpublishedPhoto, 0)
        })
    }
})
