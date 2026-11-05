import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { enrichPropertyOnCreate } from "./property_enrichment.js"

const body = {
    name: "Stan vo Skopje",
    description: "<p>Stan vo Skopje. 070 123 456</p>",
    address: "Скопје",
    type: "flat",
    listingType: "for_sale",
    size: 60,
}
const localized = text => ({ mk: text, en: text, sq: text, tr: text })
const okOutput = () => ({
    output: {
        name: localized("Стан во Скопје"),
        description: localized("<p>Стан во Скопје. 070 123 456</p>"),
        address: "Скопје",
        shouldReplaceAddress: false,
        attributes: {},
    },
})

beforeEach(() => {
    mock.restoreAll()
    mock.method(console, "error", () => {})
})

test("rethrows instead of returning the raw body", async () => {
    const generate = async () => {
        throw new Error("model down")
    }
    await assert.rejects(enrichPropertyOnCreate(body, {}, { generate }), /model down/)
})

// Review Focus 3
test("failure log holds only the error name and status, never the request body", async () => {
    const generate = async () => {
        throw {
            name: "AI_APICallError",
            statusCode: 500,
            message: "SECRET-TEXT",
            requestBodyValues: { input: "SECRET-TEXT" },
        }
    }
    await assert.rejects(enrichPropertyOnCreate(body, {}, { generate }))

    assert.equal(console.error.mock.calls.length, 1)
    const logged = JSON.stringify(console.error.mock.calls.map(call => call.arguments))
    assert.equal(logged.includes("SECRET-TEXT"), false)
    assert.ok(logged.includes("AI_APICallError"))
    assert.ok(logged.includes("500"))
})

test("gives the model call a 120 second abort signal", async () => {
    const calls = []
    const generate = async options => {
        calls.push(options)
        return okOutput()
    }
    const timeout = mock.method(AbortSignal, "timeout")
    await enrichPropertyOnCreate(body, {}, { generate })

    assert.deepEqual(timeout.mock.calls[0].arguments, [120_000])
    assert.ok(calls[0].abortSignal instanceof AbortSignal)
})

test("keeps every locale from the model output", async () => {
    const result = await enrichPropertyOnCreate(body, {}, { generate: async () => okOutput() })

    assert.equal(result.nameMk, "Стан во Скопје")
    assert.equal(result.nameTr, "Стан во Скопје")
    assert.equal(result.address, "Скопје")
})

test("puts the input's phone number back when the model output dropped it", async () => {
    const generate = async () => {
        const result = okOutput()
        result.output.description = localized("<p>Стан во Скопје.</p>")
        return result
    }
    const result = await enrichPropertyOnCreate(body, {}, { generate })

    assert.ok(result.descriptionEn.includes("070 123 456"))
})
