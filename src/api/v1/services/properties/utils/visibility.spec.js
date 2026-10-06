import assert from "node:assert/strict"
import test from "node:test"
import { hiddenPropertyConditions, isPropertyVisibleTo } from "./visibility.js"

test("legacy callers never see short-term rent or private listings", () => {
    assert.deepEqual(hiddenPropertyConditions(), [{ listingType: { not: "short_term_rent" } }, { clientId: null }])
    assert.equal(isPropertyVisibleTo({ listingType: "short_term_rent", clientId: null }), false)
    assert.equal(isPropertyVisibleTo({ listingType: "for_sale", clientId: "c1" }), false)
    assert.equal(isPropertyVisibleTo({ listingType: "for_sale", clientId: null }), true)
    assert.equal(isPropertyVisibleTo({ listingType: "for_sale" }), true)
})

test("callers with the capabilities see everything", () => {
    assert.deepEqual(hiddenPropertyConditions({ shortTermRent: true, clientListings: true }), [])
    assert.equal(
        isPropertyVisibleTo({ listingType: "short_term_rent" }, { shortTermRent: true, clientListings: true }),
        true
    )
})

test("each capability lifts only its own condition", () => {
    assert.deepEqual(hiddenPropertyConditions({ shortTermRent: true, clientListings: false }), [{ clientId: null }])
    assert.deepEqual(hiddenPropertyConditions({ shortTermRent: false, clientListings: true }), [
        { listingType: { not: "short_term_rent" } },
    ])
    assert.equal(isPropertyVisibleTo({ listingType: "for_sale", clientId: "c1" }, { clientListings: true }), true)
})

test("a missing property is never visible", () => {
    assert.equal(isPropertyVisibleTo(null, { shortTermRent: true, clientListings: true }), false)
})
