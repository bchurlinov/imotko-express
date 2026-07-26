import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { evaluatePublicationEligibility, isPublicationGuardCurrent } from "./eligibility.js"

const future = new Date("2030-01-01T00:00:00.000Z")
const now = new Date("2026-07-22T12:00:00.000Z")
const eligibleProperty = {
    id: "property-1",
    agencyId: "agency-1",
    status: "PUBLISHED",
    publishToFacebook: true,
    facebookPublishedAt: null,
    slug: "stan",
    name: { mk: "Стан" },
    description: { mk: "<p>Опис</p>" },
    photos: [{ sizes: { large: "https://images.example/1.jpg" } }],
    listingType: "for_sale",
    agency: {
        facebookConnection: {
            id: "connection-1",
            revision: 3,
            status: "CONNECTED",
            pageId: "page-1",
            encryptedPageToken: "encrypted",
            pageTokenExpiresAt: future,
            dataAccessExpiresAt: future,
            grantedScopes: ["pages_manage_posts", "pages_read_engagement"],
            pageTasks: ["CREATE_CONTENT"],
        },
    },
}

describe("evaluatePublicationEligibility", () => {
    test("accepts the complete publishable state", () => {
        assert.deepEqual(evaluatePublicationEligibility(eligibleProperty, "agency-1", now), { eligible: true })
    })

    for (const [reason, change] of [
        ["property-not-found", () => null],
        ["agency-mismatch", value => ({ ...value, agencyId: "other" })],
        ["property-not-published", value => ({ ...value, status: "UNPUBLISHED" })],
        ["consent-removed", value => ({ ...value, publishToFacebook: false })],
        ["already-published", value => ({ ...value, facebookPublishedAt: now })],
        ["missing-slug", value => ({ ...value, slug: null })],
        ["missing-macedonian-name", value => ({ ...value, name: {} })],
        ["missing-macedonian-description", value => ({ ...value, description: {} })],
        ["invalid-listing-type", value => ({ ...value, listingType: "unknown" })],
        ["missing-photos", value => ({ ...value, photos: [] })],
        [
            "page-disconnected",
            value => ({
                ...value,
                agency: { facebookConnection: { ...value.agency.facebookConnection, status: "DISCONNECTED" } },
            }),
        ],
    ]) {
        test(`skips ${reason}`, () => {
            const candidate = change(eligibleProperty)
            assert.equal(evaluatePublicationEligibility(candidate, "agency-1", now).reason, reason)
        })
    }

    test("invalidates a known expired connection", () => {
        const property = {
            ...eligibleProperty,
            agency: {
                facebookConnection: { ...eligibleProperty.agency.facebookConnection, pageTokenExpiresAt: now },
            },
        }

        assert.deepEqual(evaluatePublicationEligibility(property, "agency-1", now), {
            eligible: false,
            reason: "page-token-expired",
            connectionStatus: "EXPIRED",
            errorCode: "page-token-expired",
        })
    })

    test("skips a corrupt or missing publication timestamp", () => {
        const corruptProperty = { ...eligibleProperty, facebookPublishedAt: "corrupt" }
        const missingProperty = { ...eligibleProperty, facebookPublishedAt: undefined }

        assert.deepEqual(evaluatePublicationEligibility(corruptProperty, "agency-1", now), {
            eligible: false,
            reason: "already-published",
        })
        assert.deepEqual(evaluatePublicationEligibility(missingProperty, "agency-1", now), {
            eligible: false,
            reason: "already-published",
        })
    })

    test("accepts null expiry timestamps but invalidates malformed stored expiry values", () => {
        const noExpiry = {
            ...eligibleProperty,
            agency: {
                facebookConnection: {
                    ...eligibleProperty.agency.facebookConnection,
                    pageTokenExpiresAt: null,
                    dataAccessExpiresAt: null,
                },
            },
        }
        const malformedExpiry = {
            ...noExpiry,
            agency: {
                facebookConnection: { ...noExpiry.agency.facebookConnection, pageTokenExpiresAt: "tomorrow" },
            },
        }

        assert.deepEqual(evaluatePublicationEligibility(noExpiry, "agency-1", now), { eligible: true })
        assert.deepEqual(evaluatePublicationEligibility(malformedExpiry, "agency-1", now), {
            eligible: false,
            reason: "invalid-page-token-expiry",
            connectionStatus: "ERROR",
            errorCode: "invalid-page-token-expiry",
        })
    })

    test("handles malformed permission storage as deterministic connection failures", () => {
        const malformedScopes = {
            ...eligibleProperty,
            agency: {
                facebookConnection: { ...eligibleProperty.agency.facebookConnection, grantedScopes: null },
            },
        }
        const malformedTasks = {
            ...eligibleProperty,
            agency: {
                facebookConnection: { ...eligibleProperty.agency.facebookConnection, pageTasks: { task: "MANAGE" } },
            },
        }

        assert.deepEqual(evaluatePublicationEligibility(malformedScopes, "agency-1", now), {
            eligible: false,
            reason: "missing-page-scope",
            connectionStatus: "ERROR",
            errorCode: "missing-page-scope",
        })
        assert.deepEqual(evaluatePublicationEligibility(malformedTasks, "agency-1", now), {
            eligible: false,
            reason: "missing-page-task",
            connectionStatus: "ERROR",
            errorCode: "missing-page-task",
        })
    })

    test("returns a property-not-found skip for malformed property values", () => {
        assert.deepEqual(evaluatePublicationEligibility("not-a-property", "agency-1", now), {
            eligible: false,
            reason: "property-not-found",
        })
    })

    test("final guard rejects a changed connection revision or page", () => {
        const initial = eligibleProperty.agency.facebookConnection
        const changedRevision = {
            ...eligibleProperty,
            agency: { facebookConnection: { ...initial, revision: initial.revision + 1 } },
        }
        const changedPage = {
            ...eligibleProperty,
            agency: { facebookConnection: { ...initial, pageId: "replacement-page" } },
        }

        assert.equal(isPublicationGuardCurrent(initial, changedRevision, "agency-1", now), false)
        assert.equal(isPublicationGuardCurrent(initial, changedPage, "agency-1", now), false)
        assert.equal(isPublicationGuardCurrent(null, eligibleProperty, "agency-1", now), false)
    })
})
