import assert from "node:assert/strict"
import { beforeEach, describe, mock, test } from "node:test"
import { buildPrivateEnrichmentPrompt, clampTitle, enrichPrivateProperty } from "./private_property_enrichment.js"

const body = {
    name: "Vila Vesna 070 123 456",
    description: "<p>Vila Vesna vo Ohrid. Javete se na 070 123 456.</p>",
    address: "Охрид",
    type: "house",
    propertySubType: "VILLA",
    listingType: "short_term_rent",
    city: "ohrid",
    country: "macedonia",
    size: 120,
    numOfBathrooms: 2,
}
const localized = text => ({ mk: text, en: text, sq: text, tr: text })
const modelOutput = (overrides = {}) => ({
    name: localized("Вила во Охрид"),
    description: localized("<p>Вилата во Охрид е светла и има базен.</p>"),
    address: "Охрид",
    shouldReplaceAddress: false,
    // numOfRooms / numOfBathrooms are eligible for every type except land, garage and commercial.
    attributes: { numOfRooms: 3, numOfBathrooms: 5 },
    ...overrides,
})
const generating = output => {
    const calls = []
    const generate = async options => {
        calls.push(options)
        return { output }
    }
    return { generate, calls }
}
const failing = error => ({
    generate: async () => {
        throw error
    },
})

beforeEach(() => {
    mock.restoreAll()
})

describe("buildPrivateEnrichmentPrompt", () => {
    test("asks for removals and the private title style, never for preservation", () => {
        const prompt = buildPrivateEnrichmentPrompt(body)
        assert.ok(prompt.includes("Се продава 3-собен стан во Козле, до ОУ Владо Тасевски"))
        assert.ok(prompt.includes("Вила во село Дулица"))
        assert.ok(prompt.includes("names of people"))
        assert.ok(prompt.includes("ОУ Владо Тасевски"))
        assert.doesNotMatch(prompt, /MUST preserve/i)
        // The submitted title is never sent: the AI writes it from the description.
        assert.equal(prompt.includes("Vila Vesna 070 123 456"), false)
    })
})

describe("enrichPrivateProperty", () => {
    test("calls gpt-5 with low reasoning effort and no temperature", async () => {
        const { generate, calls } = generating(modelOutput())
        await enrichPrivateProperty(body, { sessionId: "property-p1" }, { generate })

        assert.equal(calls[0].model.modelId, "gpt-5")
        assert.deepEqual(calls[0].providerOptions, { openai: { reasoningEffort: "low" } })
        assert.equal("temperature" in calls[0], false)
    })

    test("maps every locale and merges attributes", async () => {
        const result = await enrichPrivateProperty(body, {}, generating(modelOutput()))

        assert.equal(result.name, "Вила во Охрид")
        assert.equal(result.nameMk, "Вила во Охрид")
        assert.equal(result.nameTr, "Вила во Охрид")
        assert.equal(result.descriptionEn, "<p>Вилата во Охрид е светла и има базен.</p>")
        assert.equal(result.address, "Охрид")
        // Inferred value fills a gap; the seller's own value always wins.
        assert.equal(result.numOfRooms, 3)
        assert.equal(result.numOfBathrooms, 2)
    })

    // Review Focus 5
    test("strips contact details the model left behind and clamps a runaway title", async () => {
        const longTitle = "Нова и модерна вила во Берово со базен, градина, паркинг и поглед кон езерото за цело друштво"
        const output = modelOutput({
            name: { ...localized("Вила во Охрид"), en: "Villa in Ohrid, call 070 123 456", sq: longTitle },
            description: { ...localized("<p>Вилата.</p>"), tr: "<p>Villa.</p><p>insta: vila_vesna</p>" },
        })
        const result = await enrichPrivateProperty(body, {}, generating(output))

        assert.equal(result.nameEn, "Villa in Ohrid, call")
        assert.ok(result.nameSq.length <= 70)
        assert.equal(result.nameSq.endsWith(","), false)
        assert.equal(result.descriptionTr, "<p>Villa.</p>")
    })

    test("gives the model call a 120 second abort signal", async () => {
        const { generate, calls } = generating(modelOutput())
        const timeout = mock.method(AbortSignal, "timeout")
        await enrichPrivateProperty(body, {}, { generate })

        assert.deepEqual(timeout.mock.calls[0].arguments, [120_000])
        assert.ok(calls[0].abortSignal instanceof AbortSignal)
    })

    // Review Focus 3
    test("failure log holds only the error name and status, never the request body", async () => {
        const consoleError = mock.method(console, "error", () => {})
        const { generate } = failing({
            name: "AI_APICallError",
            statusCode: 500,
            message: "SECRET-TEXT",
            requestBodyValues: { input: "SECRET-TEXT" },
        })
        await assert.rejects(enrichPrivateProperty(body, {}, { generate }))

        assert.equal(consoleError.mock.calls.length, 1)
        const logged = JSON.stringify(consoleError.mock.calls.map(call => call.arguments))
        assert.equal(logged.includes("SECRET-TEXT"), false)
        assert.ok(logged.includes("AI_APICallError"))
        assert.ok(logged.includes("500"))
    })

    test("throws when the model fails, so the caller can record FAILED", async t => {
        t.mock.method(console, "error", () => {})
        await assert.rejects(enrichPrivateProperty(body, {}, failing(new Error("model down"))), /model down/)
    })
})

describe("clampTitle", () => {
    test("keeps short titles and cuts long ones at a word", () => {
        assert.equal(clampTitle("  Вила   во Охрид "), "Вила во Охрид")
        assert.equal(clampTitle("едно две три четири", 10), "едно две")
    })
})
