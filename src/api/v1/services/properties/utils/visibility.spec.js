import assert from "node:assert/strict"
import test from "node:test"
import { hiddenPropertyConditions, isPropertyVisibleTo } from "./visibility.js"

test("legacy callers never see short-term rent", () => {
    assert.deepEqual(hiddenPropertyConditions(), [{ listingType: { not: "short_term_rent" } }])
    assert.equal(isPropertyVisibleTo({ listingType: "short_term_rent" }), false)
    assert.equal(isPropertyVisibleTo({ listingType: "for_sale" }), true)
})

test("callers with the capability see everything", () => {
    assert.deepEqual(hiddenPropertyConditions({ shortTermRent: true }), [])
    assert.equal(isPropertyVisibleTo({ listingType: "short_term_rent" }, { shortTermRent: true }), true)
})

test("a missing property is never visible", () => {
    assert.equal(isPropertyVisibleTo(null, { shortTermRent: true }), false)
})
