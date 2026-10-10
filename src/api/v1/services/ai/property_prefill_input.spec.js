import assert from "node:assert/strict"
import test from "node:test"
import { parsePrefillBody } from "./property_prefill_input.js"

const text = "Се продава трисобен стан во Карпош 4, 85 м2, трет кат, лифт, паркинг, централно греење, цена 120.000 €."

test("accepts a valid body and strips HTML", () => {
    const parsed = parsePrefillBody({ text: `<p>${text}</p>`, locale: "mk", context: { type: "flat" } })
    assert.deepEqual(parsed, { text, locale: "mk", context: { type: "flat" } })
})

test("rejects unknown top-level or context keys", () => {
    assert.equal(parsePrefillBody({ text, locale: "mk", agencyId: "x" }), null)
    assert.equal(parsePrefillBody({ text, locale: "mk", context: { agencyId: "x" } }), null)
})

test("rejects bad lengths, locales and enum hints", () => {
    assert.equal(parsePrefillBody({ text: "кратко", locale: "mk" }), null)
    assert.equal(parsePrefillBody({ text: "а".repeat(5001), locale: "mk" }), null)
    assert.equal(parsePrefillBody({ text, locale: "de" }), null)
    assert.equal(parsePrefillBody({ text, locale: "mk", context: { type: "castle" } }), null)
    assert.equal(parsePrefillBody(null), null)
})

test("drops null context hints", () => {
    assert.deepEqual(parsePrefillBody({ text, locale: "mk", context: { type: null } }).context, {})
})
