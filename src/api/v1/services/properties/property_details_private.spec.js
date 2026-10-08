import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { getPropertyService } from "./properties.service.js"

const CAPABLE = { shortTermRent: true, clientListings: true }
const originals = {
    propertyFindUnique: prisma.property.findUnique,
    viewCreate: prisma.propertyView.create,
    clientFindUnique: prisma.client.findUnique,
    userFindUnique: prisma.user.findUnique,
}
afterEach(() => {
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.propertyView.create = originals.viewCreate
    prisma.client.findUnique = originals.clientFindUnique
    prisma.user.findUnique = originals.userFindUnique
})

const privateListing = { id: "p1", listingType: "for_sale", clientId: "c9", agencyId: null, agencyContactAllowed: true }
const setup = row => {
    prisma.property.findUnique = async () => row
    prisma.propertyView.create = async () => ({})
    prisma.client.findUnique = async () => ({ user: { name: "Марко Петровски" } })
    prisma.user.findUnique = async ({ where }) =>
        where.supabaseUserId === "sb-owner" ? { client: { id: "c9" } } : { client: { id: "c1" } }
}

test("1.1.0 gets the private seller's first name and whether the viewer owns the listing", async () => {
    setup(privateListing)
    const asOwner = await getPropertyService("p1", {}, { capabilities: CAPABLE, viewerSupabaseUserId: "sb-owner" })
    assert.deepEqual(asOwner.data.seller, { type: "private", firstName: "Марко" })
    assert.deepEqual(asOwner.data.viewer, { isOwner: true })

    const asOther = await getPropertyService("p1", {}, { capabilities: CAPABLE, viewerSupabaseUserId: "sb-other" })
    assert.deepEqual(asOther.data.viewer, { isOwner: false })

    const anonymous = await getPropertyService("p1", {}, { capabilities: CAPABLE })
    assert.deepEqual(anonymous.data.viewer, { isOwner: false })
})

test("an agency listing has no seller block", async () => {
    setup({ id: "p2", listingType: "for_sale", clientId: null, agencyId: "a1" })
    const result = await getPropertyService("p2", {}, { capabilities: CAPABLE })
    assert.equal(result.data.seller, null)
})

test("app 1.0.5 gets today's payload for an agency listing", async () => {
    const row = { id: "p2", listingType: "for_sale", clientId: null, agencyId: "a1" }
    setup(row)
    const result = await getPropertyService(
        "p2",
        {},
        { capabilities: LEGACY_CAPABILITIES, viewerSupabaseUserId: "sb-owner" }
    )
    assert.deepEqual(result.data, row)
})
