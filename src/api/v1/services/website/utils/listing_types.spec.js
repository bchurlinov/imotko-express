import assert from "node:assert/strict"
import test from "node:test"
import { getAllowedListingTypes } from "./listing_types.js"

test("missing settings fall back to the column defaults", () => {
    assert.deepEqual(getAllowedListingTypes(undefined), ["for_sale", "for_rent"])
    assert.deepEqual(getAllowedListingTypes({}), ["for_sale", "for_rent"])
})

test("sales are always allowed, rentals follow the two toggles independently", () => {
    assert.deepEqual(getAllowedListingTypes({ enableRentals: false, enableShortTermRentals: false }), ["for_sale"])
    assert.deepEqual(getAllowedListingTypes({ enableRentals: true, enableShortTermRentals: true }), [
        "for_sale",
        "for_rent",
        "short_term_rent",
    ])
    assert.deepEqual(getAllowedListingTypes({ enableRentals: false, enableShortTermRentals: true }), [
        "for_sale",
        "short_term_rent",
    ])
})
