import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, mock, test } from "node:test"
import prisma from "#database/client.js"
import {
    enrichStoredProperty,
    STORED_PROPERTY_SELECT,
    toFailurePatch,
    toStoredEnrichmentInput,
    writeIfUnchanged,
} from "./property_postprocess.js"

const baseline = new Date("2026-10-10T10:00:00Z")
const stored = {
    id: "p1",
    name: { mk: "Се издава вила во Охрид", en: "Се издава вила во Охрид", sq: "x", tr: "x" },
    description: { mk: "<p>Вила Весна. 070 123 456</p>", en: "<p>insta: vila_vesna</p>", sq: "<p>ok</p>", tr: "<p>ok</p>" },
    address: "Охрид, vilavesna.mk",
    attributes: {},
    slug: "se-izdava-vila-vo-ohrid",
    type: "house",
    listingType: "short_term_rent",
    size: 120,
    agencyId: null,
    ownerId: null,
    updatedAt: baseline,
}
const storedProperty = {
    ...stored,
    clientId: null,
    status: "PENDING",
    photos: [],
    district: "Центар",
    propertyLocation: { name: "Центар", parent: { name: "Скопје" } },
    subcategory: { value: "apartment" },
}
const enriched = {
    name: "Вила во Охрид",
    nameMk: "Вила во Охрид",
    nameEn: "Villa in Ohrid",
    nameSq: "Vilë në Ohër",
    nameTr: "Ohri'de villa",
    description: "<p>Вилата.</p>",
    descriptionMk: "<p>Вилата.</p>",
    descriptionEn: "<p>The villa.</p>",
    descriptionSq: "<p>Vila.</p>",
    descriptionTr: "<p>Villa.</p>",
    address: "Охрид",
}
const aiContext = { sessionId: "property-p1", distinctId: "worker" }

// Records which enricher ran; either one can be made to fail.
const enrichers = ({ failWith } = {}) => {
    const calls = { agency: [], private: [] }
    const run = kind => async (input, context) => {
        calls[kind].push({ input, context })
        if (failWith) throw failWith
        return enriched
    }
    return { calls, deps: { enrichAgency: run("agency"), enrichPrivate: run("private") } }
}

beforeEach(() => {
    mock.restoreAll()
    mock.method(console, "info", () => {})
})

describe("STORED_PROPERTY_SELECT", () => {
    test("adds the worker fields to the text fields", () => {
        const expected = {
            id: true,
            name: true,
            description: true,
            updatedAt: true,
            clientId: true,
            status: true,
            photos: true,
            district: true,
            propertyLocation: { select: { name: true, parent: { select: { name: true } } } },
            subcategory: { select: { value: true } },
        }
        for (const [key, value] of Object.entries(expected)) assert.deepEqual(STORED_PROPERTY_SELECT[key], value, key)
    })
})

describe("toStoredEnrichmentInput", () => {
    test("builds city as parent-name and picks mk text", () => {
        const input = toStoredEnrichmentInput(storedProperty)
        assert.equal(input.city, "Скопје-Центар")
        assert.equal(input.district, "Центар")
        assert.equal(input.name, stored.name.mk)
        assert.equal(input.description, stored.description.mk)
        assert.equal(input.propertySubType, "apartment")
        assert.equal(input.type, "house")
        assert.equal(input.address, stored.address)
    })

    test("uses just the name when the location has no parent and tolerates a missing location", () => {
        const noParent = toStoredEnrichmentInput({ ...storedProperty, propertyLocation: { name: "Охрид", parent: null } })
        assert.equal(noParent.city, "Охрид")

        const none = toStoredEnrichmentInput({ ...storedProperty, propertyLocation: null, subcategory: null })
        assert.equal(none.city, undefined)
        assert.equal(none.propertySubType, undefined)
    })
})

describe("enrichStoredProperty", () => {
    test("uses private enrichment when clientId is set and throws on failure", async () => {
        const { calls, deps } = enrichers()
        const patch = await enrichStoredProperty({ ...storedProperty, clientId: "c1" }, aiContext, deps)

        assert.equal(calls.agency.length, 0)
        assert.equal(calls.private.length, 1)
        assert.equal(calls.private[0].input.city, "Скопје-Центар")
        assert.equal(calls.private[0].input.propertySubType, "apartment")
        assert.equal(calls.private[0].context, aiContext)
        assert.equal(patch.name.en, "Villa in Ohrid")

        const failing = enrichers({ failWith: new Error("model down") })
        await assert.rejects(
            enrichStoredProperty({ ...storedProperty, clientId: "c1" }, aiContext, failing.deps),
            /model down/
        )
    })

    test("uses agency enrichment without a clientId and throws on failure", async () => {
        const { calls, deps } = enrichers()
        const patch = await enrichStoredProperty({ ...storedProperty, agencyId: "a1" }, aiContext, deps)

        assert.equal(calls.private.length, 0)
        assert.equal(calls.agency.length, 1)
        assert.equal(patch.description.mk, "<p>Вилата.</p>")

        const failing = enrichers({ failWith: new Error("model down") })
        await assert.rejects(
            enrichStoredProperty({ ...storedProperty, agencyId: "a1" }, aiContext, failing.deps),
            /model down/
        )
    })

    test("patch sets aiStatus DONE for agency and private", async () => {
        const { deps } = enrichers()

        const agency = await enrichStoredProperty({ ...storedProperty, agencyId: "a1" }, aiContext, deps)
        const priv = await enrichStoredProperty({ ...storedProperty, clientId: "c1" }, aiContext, deps)

        assert.equal(agency.aiStatus, "DONE")
        assert.equal(priv.aiStatus, "DONE")
        assert.ok(agency.updatedAt instanceof Date)
        assert.equal(typeof agency.slug, "string")
        assert.ok(agency.slug.length > 0)
    })
})

describe("toFailurePatch", () => {
    test("private strips contact details and sets FAILED", () => {
        const patch = toFailurePatch({ ...storedProperty, clientId: "c1" })
        assert.equal(patch.aiStatus, "FAILED")
        assert.equal(patch.description.mk, "<p>Вила Весна.</p>")
        assert.equal(patch.description.en, "")
        assert.equal(patch.address, "Охрид,")
        assert.deepEqual(patch.name, stored.name)
        assert.ok(patch.updatedAt instanceof Date)
    })

    test("agency only sets FAILED and updatedAt", () => {
        const patch = toFailurePatch({ ...storedProperty, agencyId: "a1" })
        assert.deepEqual(Object.keys(patch).sort(), ["aiStatus", "updatedAt"])
        assert.equal(patch.aiStatus, "FAILED")
    })
})

describe("writeIfUnchanged", () => {
    const original = prisma.property.updateMany
    afterEach(() => {
        prisma.property.updateMany = original
    })

    test("returns true when the guarded update matched a row", async () => {
        const calls = []
        prisma.property.updateMany = async args => {
            calls.push(args)
            return { count: 1 }
        }

        assert.equal(await writeIfUnchanged("p1", baseline, { slug: "x" }), true)
        assert.deepEqual(calls, [{ where: { id: "p1", updatedAt: baseline }, data: { slug: "x" } }])
    })

    test("returns false when a newer edit changed updatedAt", async () => {
        prisma.property.updateMany = async () => ({ count: 0 })

        assert.equal(await writeIfUnchanged("p1", baseline, { slug: "x" }), false)
    })
})
