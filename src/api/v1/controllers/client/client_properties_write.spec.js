import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, test } from "node:test"
import prisma from "#database/client.js"
import {
    bumpClientPropertyController,
    clientListingEffects,
    createClientPropertyController,
    deleteClientPropertyController,
    setAgencyContactController,
    setClientPropertyVisibilityController,
    updateClientPropertyController,
} from "./client_properties.controller.js"
import { scheduleAiPostprocess } from "#services/client/client_ai.service.js"
import { buildPlaceholderTitle } from "#shared/property_rules/placeholder_title.js"

const cases = JSON.parse(readFileSync(new URL("../../../../shared/property_rules/shared_cases.json", import.meta.url), "utf8"))
const originals = {
    transaction: prisma.$transaction,
    propertyFindUnique: prisma.property.findUnique,
    propertyUpdateMany: prisma.property.updateMany,
    scheduleAi: clientListingEffects.scheduleAi,
}
let scheduled = []
beforeEach(() => {
    scheduled = []
    clientListingEffects.scheduleAi = args => scheduled.push(args)
})
afterEach(() => {
    clientListingEffects.scheduleAi = originals.scheduleAi
    prisma.$transaction = originals.transaction
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.property.updateMany = originals.propertyUpdateMany
})

const fakeRes = () => ({
    statusCode: 0,
    body: null,
    status(code) {
        this.statusCode = code
        return this
    },
    json(body) {
        this.body = body
        return this
    },
})
const ownedPhoto = {
    id: "img1",
    originalKey: "uploads/user-u1/img1/v1/original-a.jpg",
    s3Urls: ["uploads/user-u1/img1/v1/original-a.jpg", "uploads/user-u1/img1/v1/small.jpg"],
    sizes: { small: "https://x/small.jpg" },
}
const body = (patch = {}) => ({ ...cases.baseListing, images: [ownedPhoto], ...patch })
const request = (extra = {}) => ({
    chatViewer: { type: "client", userId: "u1" },
    chatUser: { id: "u1", role: "CLIENT" },
    client: { id: "c1", credits: 150 },
    params: { id: "p1" },
    body: body(),
    ...extra,
})
const fakeTx = (overrides = {}) => {
    const calls = {}
    const tx = {
        $executeRaw: async () => 1,
        property: {
            count: async () => 0,
            create: async ({ data }) => {
                calls.create = data
                return { id: "p1", slug: "svetol", status: "PENDING", listingType: "for_sale", updatedAt: new Date(0) }
            },
            update: async ({ data }) => {
                calls.update = data
                return { id: "p1", slug: "svetol", status: "PENDING", listingType: "for_sale", updatedAt: new Date(0) }
            },
        },
        propertyLocation: { upsert: async () => ({ id: "loc1" }) },
        propertyCategory: { upsert: async () => ({ id: "1" }) },
        propertySubcategory: { upsert: async () => ({ id: "102" }) },
        propertySubmissionReview: { deleteMany: async () => ({ count: 1 }) },
        client: { updateMany: async () => ({ count: 1 }) },
        ...overrides,
    }
    prisma.$transaction = async fn => fn(tx)
    return calls
}

// Review Focus 4
test("create stores a PENDING private listing with the web's forced fields", async () => {
    const calls = fakeTx()
    const res = fakeRes()
    await createClientPropertyController(request(), res)
    assert.equal(res.statusCode, 201)
    assert.equal(res.body.message, "clientListingSubmitted")
    assert.equal(calls.create.status, "PENDING")
    assert.equal(calls.create.publishToFacebook, false)
    assert.equal(calls.create.publishToHommex, false)
    assert.equal(calls.create.agencyContactAllowed, true)
    assert.equal(calls.create.createdBy, "u1")
    assert.deepEqual(calls.create.client, { connect: { id: "c1" } })
    assert.equal(calls.create.latitude, 41.1231)
    assert.equal(scheduled.length, 1)
    assert.equal(scheduled[0].propertyId, "p1")
    assert.equal(scheduled[0].userId, "u1")
})

test("create replaces any title with the placeholder, marks aiStatus PENDING and schedules the private AI step", async () => {
    const calls = fakeTx()
    await createClientPropertyController(request({ body: body({ name: "Vila Vesna 070 123 456" }) }), fakeRes())
    assert.equal(calls.create.name.mk, buildPlaceholderTitle(cases.baseListing))
    assert.equal(calls.create.aiStatus, "PENDING")
    assert.equal(scheduled[0].listerKind, "private")
})

test("edit schedules the private AI step with the saved updatedAt", async () => {
    const calls = fakeTx()
    prisma.property.findUnique = async () => ({
        id: "p1",
        clientId: "c1",
        status: "PUBLISHED",
        listingType: "for_sale",
        slug: "svetol",
        photos: [ownedPhoto],
        propertyPlan: [],
    })
    await updateClientPropertyController(request(), fakeRes())
    assert.equal(calls.update.aiStatus, "PENDING")
    assert.equal(scheduled.length, 1)
    assert.equal(scheduled[0].listerKind, "private")
    assert.deepEqual(scheduled[0].baselineUpdatedAt, new Date(0))
})

test("create refuses a phone number in the description and photos from someone else's folder", async () => {
    fakeTx()
    await assert.rejects(
        () => createClientPropertyController(request({ body: body({ description: "Јавете се на 070 123 456 за повеќе" }) }), fakeRes()),
        { code: "contactDetailsNotAllowed", status: 400 }
    )
    const stranger = { ...ownedPhoto, originalKey: "uploads/user-u2/img1/v1/original-a.jpg", s3Urls: ["uploads/user-u2/img1/v1/small.jpg"] }
    await assert.rejects(
        () => createClientPropertyController(request({ body: body({ images: [stranger] }) }), fakeRes()),
        { code: "validationFailed", status: 400 }
    )
})

test("create stops at the per-type limit", async () => {
    fakeTx({
        $executeRaw: async () => 1,
        property: { count: async () => 5 },
    })
    await assert.rejects(() => createClientPropertyController(request(), fakeRes()), {
        code: "clientListingLimitReached",
        status: 409,
    })
})

test("edit puts the listing back to PENDING and ignores agencyContactAllowed", async () => {
    prisma.property.findUnique = async () => ({
        id: "p1",
        clientId: "c1",
        status: "PUBLISHED",
        listingType: "for_sale",
        slug: "svetol",
        photos: [ownedPhoto],
        propertyPlan: [],
    })
    const calls = fakeTx()
    const res = fakeRes()
    await updateClientPropertyController(request({ body: body({ agencyContactAllowed: false }) }), res)
    assert.equal(res.statusCode, 200)
    assert.equal(calls.update.status, "PENDING")
    assert.equal("agencyContactAllowed" in calls.update, false)
})

test("someone else's listing answers 404 on every write", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c9", status: "PUBLISHED" })
    for (const controller of [
        updateClientPropertyController,
        deleteClientPropertyController,
        setClientPropertyVisibilityController,
        setAgencyContactController,
        bumpClientPropertyController,
    ]) {
        await assert.rejects(() => controller(request({ body: { visible: true, allowed: true } }), fakeRes()), {
            code: "propertyNotFound",
            status: 404,
        })
    }
})

test("visibility only flips PUBLISHED ↔ UNPUBLISHED", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c1", status: "PENDING", slug: "s" })
    prisma.property.updateMany = async () => ({ count: 0 })
    await assert.rejects(() => setClientPropertyVisibilityController(request({ body: { visible: false } }), fakeRes()), {
        code: "invalidListingStatus",
        status: 409,
    })
})

test("agency contact saves at once without touching the status", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c1", status: "PUBLISHED", slug: "s" })
    let data
    prisma.property.updateMany = async input => {
        data = input.data
        return { count: 1 }
    }
    const res = fakeRes()
    await setAgencyContactController(request({ body: { allowed: false } }), res)
    assert.deepEqual(data, { agencyContactAllowed: false })
    assert.equal(res.body.message, "agencyContactBlockedSaved")
})

test("renew is free: no credits are spent and it only matches listings not renewed since today's midnight", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c1", status: "PUBLISHED", slug: "s" })
    let spent = false
    fakeTx({ client: { updateMany: async () => ((spent = true), { count: 1 }) } })
    let query
    prisma.property.updateMany = async input => {
        query = input
        return { count: 1 }
    }
    const res = fakeRes()
    await bumpClientPropertyController(request(), res)
    assert.equal(spent, false)
    assert.equal(res.body.message, "propertyRestartSuccess")
    assert.deepEqual(
        { id: query.where.id, clientId: query.where.clientId, status: query.where.status },
        { id: "p1", clientId: "c1", status: "PUBLISHED" }
    )
    assert.deepEqual(query.where.OR[0], { bumpedAt: null })
    assert.ok(query.where.OR[1].bumpedAt.lt instanceof Date)
    assert.ok(query.data.bumpedAt instanceof Date)
})

test("renew answers 409 renewLimitReached when the listing was already renewed today", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c1", status: "PUBLISHED", slug: "s" })
    prisma.property.updateMany = async () => ({ count: 0 })
    await assert.rejects(() => bumpClientPropertyController(request(), fakeRes()), {
        code: "renewLimitReached",
        status: 409,
    })
})

test("renew refuses a listing that is not published", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c1", status: "PENDING", slug: "s" })
    await assert.rejects(() => bumpClientPropertyController(request(), fakeRes()), {
        code: "invalidListingStatus",
        status: 409,
    })
})

test("delete is soft", async () => {
    prisma.property.findUnique = async () => ({ id: "p1", clientId: "c1", status: "PUBLISHED", slug: "s" })
    let data
    prisma.property.updateMany = async input => {
        data = input.data
        return { count: 1 }
    }
    await deleteClientPropertyController(request(), fakeRes())
    assert.deepEqual(data, { status: "DELETED", autoRenewEnabled: false })
})

test("the AI step runs after the response and never throws into it", async () => {
    let ran
    let deferred
    scheduleAiPostprocess({ propertyId: "p1" }, { run: async args => (ran = args), defer: fn => (deferred = fn) })
    assert.equal(ran, undefined)
    deferred()
    assert.deepEqual(ran, { propertyId: "p1" })
    scheduleAiPostprocess({}, { run: async () => Promise.reject(new Error("model down")), defer: fn => fn() })
})
