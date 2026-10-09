import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { requireClientAccount, requireClientListingsCapability } from "#middlewares/client_listings_guard.js"
import { getClientPropertyController, listClientPropertiesController } from "./client_properties.controller.js"
import { clientListingErrorResponder } from "./client_listing_response.js"

const CAPABLE = { shortTermRent: true, clientListings: true }
const originals = {
    clientFindUnique: prisma.client.findUnique,
    propertyFindMany: prisma.property.findMany,
    propertyFindFirst: prisma.property.findFirst,
    propertyGroupBy: prisma.property.groupBy,
    agencyFindFirst: prisma.agency.findFirst,
    propertyViewCount: prisma.propertyView.count,
}
afterEach(() => {
    prisma.client.findUnique = originals.clientFindUnique
    prisma.propertyView.count = originals.propertyViewCount
    prisma.property.findMany = originals.propertyFindMany
    prisma.property.findFirst = originals.propertyFindFirst
    prisma.property.groupBy = originals.propertyGroupBy
    prisma.agency.findFirst = originals.agencyFindFirst
})

export const fakeRes = () => ({
    statusCode: 0,
    body: null,
    headersSent: false,
    status(code) {
        this.statusCode = code
        return this
    },
    json(body) {
        this.body = body
        return this
    },
})
const nextError = async (middleware, req) => {
    let received
    await middleware(req, fakeRes(), error => {
        received = error
    })
    return received
}

test("callers without client listings get 404 before any auth", async () => {
    const error = await nextError(requireClientListingsCapability, { capabilities: LEGACY_CAPABILITIES })
    assert.equal(error.status, 404)
    assert.equal(error.code, "propertyNotFound")
    assert.equal(await nextError(requireClientListingsCapability, { capabilities: CAPABLE }), undefined)
})
test("agency accounts and users without a client row get 403 forbidden", async () => {
    const agency = await nextError(requireClientAccount, { chatViewer: { type: "agency", userId: "u2" } })
    assert.deepEqual([agency.status, agency.code], [403, "forbidden"])
    prisma.client.findUnique = async () => null
    const noClient = await nextError(requireClientAccount, { chatViewer: { type: "client", userId: "u1" } })
    assert.deepEqual([noClient.status, noClient.code], [403, "forbidden"])
    prisma.client.findUnique = async () => ({ id: "c1", credits: 150 })
    const req = { chatViewer: { type: "client", userId: "u1" } }
    assert.equal(await nextError(requireClientAccount, req), undefined)
    assert.deepEqual(req.client, { id: "c1", credits: 150 })
})
test("the list returns credits, limits, counts, the agency request and public photos", async () => {
    prisma.client.findUnique = async () => ({ id: "c1", credits: 140 })
    prisma.property.findMany = async () => [
        {
            id: "p1",
            status: "PUBLISHED",
            listingType: "for_sale",
            photos: [
                { id: "i1", name: null, sizes: { small: "s" }, originalKey: "uploads/user-u1/i1/v/original-x.jpg" },
            ],
            _count: { outreaches: 2 },
            propertyReview: [],
        },
    ]
    prisma.property.groupBy = async () => [{ listingType: "for_sale", _count: { _all: 1 } }]
    prisma.agency.findFirst = async () => null
    prisma.propertyView.count = async () => 0
    const res = fakeRes()
    await listClientPropertiesController({ chatViewer: { type: "client", userId: "u1" }, client: { id: "c1" } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.credits, 140)
    assert.equal(res.body.data.limitPerType, 5)
    assert.equal(res.body.data.counts.for_sale, 1)
    assert.equal(res.body.data.agencyRequest, null)
    assert.equal(res.body.data.properties[0]._count.outreaches, 2)
    assert.equal(res.body.data.properties[0].canRenew, true)
    assert.deepEqual(res.body.data.properties[0].photos[0], { id: "i1", name: null, sizes: { small: "s" } })
})
test("edit data: own listing only, and it does not count against its own type", async () => {
    prisma.property.findFirst = async ({ where }) =>
        where.id === "p1" && where.clientId === "c1" ? { id: "p1", status: "PUBLISHED", listingType: "for_sale" } : null
    prisma.property.groupBy = async () => [{ listingType: "for_sale", _count: { _all: 5 } }]
    const res = fakeRes()
    await getClientPropertyController({ client: { id: "c1" }, params: { id: "p1" } }, res)
    assert.equal(res.body.data.counts.for_sale, 4)
    await assert.rejects(() => getClientPropertyController({ client: { id: "c1" }, params: { id: "p9" } }, fakeRes()), {
        status: 404,
        code: "propertyNotFound",
    })
})
test("the responder maps yup errors to field codes like the web", async () => {
    const yup = await import("yup")
    const error = new yup.ValidationError([
        new yup.ValidationError("propertyPriceRequired", undefined, "price"),
        new yup.ValidationError("propertySizeRequired", undefined, "size"),
    ])
    const res = fakeRes()
    clientListingErrorResponder(error, { method: "POST", originalUrl: "/x" }, res, () => {})
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body, {
        data: { price: "propertyPriceRequired", size: "propertySizeRequired" },
        code: 400,
        message: "validationFailed",
    })
})
