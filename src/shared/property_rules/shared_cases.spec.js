import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PropertySchema } from "./property.schema.js"
import { findContactDetailsField } from "./contact_details.js"
import { normalizeListingTypeFields } from "./listing_type_rules.js"
import { resolvePropertyTaxonomy } from "./property_dto.js"
import { firstNameOf, shortDisplayName } from "./seller_name.js"
import { CLIENT_LISTING_COUNTED_STATUSES, CLIENT_LISTING_LIMIT_PER_TYPE } from "./client_listings_constants.js"

// Web shared cases run against Express copies. Express has no price formatter, so priceFormat is skipped.
const cases = JSON.parse(readFileSync(new URL("./shared_cases.json", import.meta.url), "utf8"))

const validationErrors = async body => {
    try {
        await PropertySchema.validate(body, { abortEarly: false, context: { isAdmin: false } })
        return []
    } catch (error) {
        return [...error.errors].sort()
    }
}

for (const { name, patch, errors } of cases.schema) {
    test(`schema: ${name}`, async () => {
        assert.deepEqual(await validationErrors({ ...cases.baseListing, ...patch }), [...errors].sort())
    })
}

for (const { input, expected } of cases.contactDetails) {
    test(`contact details: ${expected}`, () => assert.equal(findContactDetailsField(input), expected))
}

for (const { input, expected } of cases.normalizeListingTypeFields) {
    test(`normalizeListingTypeFields: ${input.listingType}`, () =>
        assert.deepEqual(normalizeListingTypeFields(input), expected))
}

for (const { type, subType, expected } of cases.taxonomy) {
    test(`taxonomy: ${type}/${subType}`, () => {
        const result = resolvePropertyTaxonomy(type, subType)
        assert.deepEqual(result ? { categoryId: result.categoryId, subcategoryId: result.subcategory.id } : null, expected)
    })
}

for (const { input, short, first } of cases.sellerName) {
    test(`seller name: ${short}`, () => {
        assert.equal(shortDisplayName(input), short)
        assert.equal(firstNameOf(input.name), first)
    })
}

test("limit", () => {
    assert.equal(CLIENT_LISTING_LIMIT_PER_TYPE, cases.limit.perType)
    assert.deepEqual([...CLIENT_LISTING_COUNTED_STATUSES], cases.limit.countedStatuses)
})
