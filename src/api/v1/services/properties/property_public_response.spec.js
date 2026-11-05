import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { AGENCY_WEBSITE_SELECT } from "#services/website/utils/agency.js"
import { getPropertyService } from "./properties.service.js"

const originals = { findUnique: prisma.property.findUnique, viewCreate: prisma.propertyView.create }
afterEach(() => {
    prisma.property.findUnique = originals.findUnique
    prisma.propertyView.create = originals.viewCreate
})

const load = async row => {
    let args
    prisma.property.findUnique = async received => {
        args = received
        return row
    }
    prisma.propertyView.create = async () => ({})
    const result = await getPropertyService("p1", {})
    return { args, data: result.data }
}

const row = { id: "p1", agencyId: "a1", listingType: "for_sale", clientId: null, modifications: { name: "draft" } }

test("property detail loads only allowlisted user, member and agency fields", async () => {
    const { args } = await load(row)
    const member = args.include.createdByMember
    const agency = args.include.agency

    assert.equal(member.include, undefined)
    assert.deepEqual(Object.keys(member.select).sort(), ["id", "position", "user"])
    assert.deepEqual(Object.keys(member.select.user.select).sort(), ["email", "image", "lastName", "name", "phone"])
    for (const field of ["taxNumber", "credits", "plan", "planUntil", "ownerId", "owner"]) {
        assert.equal(agency.select[field], undefined, `${field} must stay private`)
    }
})

test("property detail omits internal CRM fields", async () => {
    const { args } = await load(row)

    assert.deepEqual(args.omit, { remarks: true, ownerId: true, renterId: true })
})

test("published listings drop pending edits, unpublished listings keep them for the app fallback", async () => {
    const published = await load({ ...row, status: "PUBLISHED" })
    assert.equal("modifications" in published.data, false)
    assert.equal(published.data.id, "p1")

    const pending = await load({ ...row, status: "PENDING" })
    assert.deepEqual(pending.data.modifications, { name: "draft" })
})

test("agency website config exposes only the member fields templates display", () => {
    const members = AGENCY_WEBSITE_SELECT.agencyMembers

    assert.equal(members.include, undefined)
    assert.deepEqual(Object.keys(members.select).sort(), ["id", "position", "user"])
    assert.deepEqual(Object.keys(members.select.user.select).sort(), ["lastName", "name", "phone"])
})
