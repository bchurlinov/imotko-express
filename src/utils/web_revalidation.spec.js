import assert from "node:assert/strict"
import test from "node:test"
import { notifyWebProperty } from "./web_revalidation.js"

const env = { INTERNAL_API_SECRET: "s3cret", IMOTKO_WEB_URL: "https://imotko.test/" }
const quiet = { error: () => {} }
const noSleep = async () => {}

const recordingFetch = (impl = async () => new Response("{}", { status: 200 })) => {
    const calls = []
    const fetchImpl = async (...args) => {
        calls.push(args)
        return impl(...args)
    }
    return { calls, fetchImpl }
}

test("does nothing while INTERNAL_API_SECRET is unset", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyWebProperty({ propertyId: "p1" }, { env: {}, fetchImpl, logger: quiet })
    assert.equal(calls.length, 0)
})

test("does nothing without a property id", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyWebProperty({}, { env, fetchImpl, logger: quiet })
    assert.equal(calls.length, 0)
})

test("posts the property id to the web app with the internal secret header", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyWebProperty({ propertyId: "p1" }, { env, fetchImpl, logger: quiet })
    assert.equal(calls.length, 1)
    const [url, init] = calls[0]
    assert.equal(url, "https://imotko.test/api/internal/property-revalidate")
    assert.equal(init.method, "POST")
    assert.equal(init.headers["X-Imotko-Internal-Secret"], "s3cret")
    assert.deepEqual(JSON.parse(init.body), { propertyId: "p1" })
})

test("never throws when the web app is down", async () => {
    const { calls, fetchImpl } = recordingFetch(async () => {
        throw new TypeError("fetch failed")
    })
    await notifyWebProperty({ propertyId: "p1" }, { env, fetchImpl, logger: quiet, sleep: noSleep })
    assert.equal(calls.length, 2)
})
