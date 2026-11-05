import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createWebRevalidator } from "./revalidate.js"

const respond = status => ({ ok: status >= 200 && status < 300, status })

const setup = (responses, { webUrl = "https://imotko.mk" } = {}) => {
    const calls = []
    const sleeps = []
    const queue = [...responses]
    const fetchImpl = async (url, init) => {
        calls.push({ url, init })
        const next = queue.shift()
        if (next instanceof Error) throw next
        return next
    }
    const sleep = async ms => {
        sleeps.push(ms)
    }
    const logs = []
    const logger = { info: (...args) => logs.push(["info", ...args]), error: (...args) => logs.push(["error", ...args]) }
    const revalidate = createWebRevalidator({ webUrl, internalSecret: "internal-secret", fetchImpl, sleep, logger })
    return { revalidate, calls, sleeps, logs }
}

describe("createWebRevalidator", () => {
    test("POSTs the ids with the internal secret header and a 5s timeout", async () => {
        const { revalidate, calls } = setup([respond(200)])
        await revalidate({ propertyId: "p1", previousSlug: "old" })

        assert.equal(calls.length, 1)
        assert.equal(calls[0].url, "https://imotko.mk/api/internal/property-revalidate")
        assert.equal(calls[0].init.method, "POST")
        assert.equal(calls[0].init.headers["X-Imotko-Internal-Secret"], "internal-secret")
        assert.equal(calls[0].init.headers["Content-Type"], "application/json")
        assert.deepEqual(JSON.parse(calls[0].init.body), { propertyId: "p1", previousSlug: "old" })
        assert.ok(calls[0].init.signal instanceof AbortSignal)
    })

    test("omits previousSlug from the body when there is none", async () => {
        const { revalidate, calls } = setup([respond(200)])
        await revalidate({ propertyId: "p1" })
        assert.deepEqual(JSON.parse(calls[0].init.body), { propertyId: "p1" })
    })

    test("the request signal aborts after 5 seconds", async () => {
        let signal
        const revalidate = createWebRevalidator({
            webUrl: "https://imotko.mk",
            internalSecret: "s",
            fetchImpl: async (url, init) => {
                signal = init.signal
                return respond(200)
            },
            sleep: async () => {},
        })
        const originalTimeout = AbortSignal.timeout
        const timeouts = []
        AbortSignal.timeout = ms => {
            timeouts.push(ms)
            return originalTimeout.call(AbortSignal, ms)
        }
        try {
            await revalidate({ propertyId: "p1" })
        } finally {
            AbortSignal.timeout = originalTimeout
        }
        assert.deepEqual(timeouts, [5000])
        assert.ok(signal)
    })

    test("retries once after a 5xx and stops when the retry succeeds", async () => {
        const { revalidate, calls, sleeps } = setup([respond(503), respond(200)])
        await revalidate({ propertyId: "p1" })
        assert.equal(calls.length, 2)
        assert.equal(sleeps.length, 1)
    })

    test("retries once after a network failure", async () => {
        const { revalidate, calls } = setup([new TypeError("fetch failed"), respond(200)])
        await revalidate({ propertyId: "p1" })
        assert.equal(calls.length, 2)
    })

    test("retries only once: two 5xx responses end the attempts without rejecting", async () => {
        const { revalidate, calls } = setup([respond(500), respond(502), respond(200)])
        await assert.doesNotReject(revalidate({ propertyId: "p1" }))
        assert.equal(calls.length, 2)
    })

    test("never rejects when the network fails both times", async () => {
        const { revalidate, calls } = setup([new TypeError("fetch failed"), new Error("timeout")])
        await assert.doesNotReject(revalidate({ propertyId: "p1" }))
        assert.equal(calls.length, 2)
    })

    test("does not retry a 4xx response", async () => {
        const { revalidate, calls } = setup([respond(401)])
        await revalidate({ propertyId: "p1" })
        assert.equal(calls.length, 1)
    })

    test("logs only the property id, status codes and error names", async () => {
        const secretError = Object.assign(new Error("connect to https://imotko.mk with internal-secret failed"), {
            name: "FetchError",
        })
        const { revalidate, logs } = setup([secretError, respond(500)])
        await revalidate({ propertyId: "p1", previousSlug: "slug-with-listing-text" })

        const serialized = JSON.stringify(logs)
        assert.ok(logs.length > 0)
        assert.ok(serialized.includes("FetchError"))
        assert.ok(serialized.includes("500"))
        assert.ok(!serialized.includes("internal-secret"))
        assert.ok(!serialized.includes("connect to"))
        assert.ok(!serialized.includes("slug-with-listing-text"))
    })

    test("logs the cause code of a network failure, because fetch always throws a plain TypeError", async () => {
        const networkError = new TypeError("fetch failed", { cause: Object.assign(new Error("https://secret-host"), { code: "UND_ERR_SOCKET" }) })
        const { revalidate, logs } = setup([networkError, respond(200)])
        await revalidate({ propertyId: "p1" })

        assert.deepEqual(logs, [
            ["error", "property_revalidate_failed", { propertyId: "p1", attempt: 1, errorCode: "TypeError", causeCode: "UND_ERR_SOCKET" }],
        ])
    })

    test("leaves the cause code out when the error has none", async () => {
        const { revalidate, logs } = setup([new TypeError("fetch failed"), respond(200)])
        await revalidate({ propertyId: "p1" })

        assert.deepEqual(logs, [["error", "property_revalidate_failed", { propertyId: "p1", attempt: 1, errorCode: "TypeError" }]])
    })
})
