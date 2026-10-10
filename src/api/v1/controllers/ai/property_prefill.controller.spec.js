import assert from "node:assert/strict"
import test from "node:test"
import { EventEmitter } from "node:events"
import { PrefillTimeoutError } from "#shared/ai/property_prefill/extract.js"
import { createPropertyPrefillController } from "./property_prefill.controller.js"

const text = "Се продава трисобен стан во Карпош 4, 85 м2, трет кат, лифт, паркинг, централно греење, цена 120.000 €."

const fakeRes = () => {
    const res = new EventEmitter()
    res.writableFinished = false
    res.status = code => ((res.statusCode = code), res)
    res.json = body => ((res.body = body), (res.writableFinished = true), res)
    return res
}

const call = async (extract, body = { text, locale: "mk" }) => {
    const req = { body, actor: { kind: "agency", userId: "u1", agencyId: "a1" } }
    const res = fakeRes()
    let nextArg
    await createPropertyPrefillController({ extract })(req, res, arg => (nextArg = arg))
    return { res, nextArg }
}

test("200 with verified fields", async () => {
    const { res } = await call(async () => ({ fields: { type: "flat" }, skipped: 2 }))
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { data: { fields: { type: "flat" }, skipped: 2 }, message: "ok" })
})

test("invalid body → 400 without calling the LLM", async () => {
    let called = false
    const { nextArg } = await call(async () => ((called = true), {}), { text: "x", locale: "mk" })
    assert.equal(nextArg.status, 400)
    assert.equal(called, false)
})

test("timeout → 504 aiPrefillTimeout", async () => {
    const { nextArg } = await call(async () => Promise.reject(new PrefillTimeoutError()))
    assert.equal(nextArg.status, 504)
    assert.equal(nextArg.message, "aiPrefillTimeout")
})

test("other failure → 502 aiPrefillFailed", async () => {
    const { nextArg } = await call(async () => Promise.reject(new Error("openai down")))
    assert.equal(nextArg.status, 502)
})

test("client disconnect aborts the LLM call and sends nothing", async () => {
    let seenSignal
    const req = { body: { text, locale: "mk" }, actor: { kind: "agency", userId: "u1" } }
    const res = fakeRes()
    let nextArg = "untouched"
    const pending = createPropertyPrefillController({
        extract: ({ signal }) =>
            new Promise((_, reject) => {
                seenSignal = signal
                signal.addEventListener("abort", () => reject(new Error("aborted")))
            }),
    })(req, res, arg => (nextArg = arg))
    res.emit("close")
    await pending
    assert.equal(seenSignal.aborted, true)
    assert.equal(nextArg, "untouched")
    assert.equal(res.body, undefined)
})

const capturedInput = async capabilities => {
    let input
    const req = { body: { text, locale: "mk" }, actor: { kind: "agency", userId: "u1" }, capabilities }
    await createPropertyPrefillController({
        extract: async args => ((input = args), { fields: {}, skipped: 0 }),
    })(req, fakeRes(), () => {})
    return input
}

test("short-term rent is allowed only for callers with the capability", async () => {
    assert.equal((await capturedInput({ shortTermRent: true })).includeShortTerm, true)
    assert.equal((await capturedInput({ shortTermRent: false })).includeShortTerm, false)
    assert.equal((await capturedInput(undefined)).includeShortTerm, false)
})
