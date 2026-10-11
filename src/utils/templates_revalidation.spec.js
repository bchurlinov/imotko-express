import assert from "node:assert/strict"
import test from "node:test"
import { buildRevalidateUrl, notifyTemplates } from "./templates_revalidation.js"

const env = { REVALIDATE_SECRET: "s3cret" }
const site = url => async () => url

const recordingFetch = (impl = async () => new Response("{}", { status: 200 })) => {
    const calls = []
    const fetchImpl = async (...args) => {
        calls.push(args)
        return impl(...args)
    }
    return { calls, fetchImpl }
}

test("builds the revalidate url from https and localhost origins", () => {
    assert.equal(buildRevalidateUrl("https://delta.mk"), "https://delta.mk/api/revalidate")
    assert.equal(buildRevalidateUrl("http://localhost:3000"), "http://localhost:3000/api/revalidate")
    assert.equal(buildRevalidateUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/api/revalidate")
})

test("rejects unusable or insecure addresses", () => {
    for (const value of [null, undefined, "", "not a url", "http://delta.mk", "ftp://delta.mk"]) {
        assert.equal(buildRevalidateUrl(value), null, String(value))
    }
})

test("skips without agencyId", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyTemplates(
        { agencyId: null, propertyId: "p1" },
        { fetchImpl, env, getWebsiteUrl: site("https://delta.mk") }
    )
    assert.equal(calls.length, 0)
})

test("skips when the secret is missing", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyTemplates({ agencyId: "a1" }, { fetchImpl, env: {}, getWebsiteUrl: site("https://delta.mk") })
    assert.equal(calls.length, 0)
})

test("skips when the agency has no website address", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyTemplates({ agencyId: "a1" }, { fetchImpl, env, getWebsiteUrl: site(null) })
    assert.equal(calls.length, 0)
})

test("never sends the secret to a non-https, non-localhost address", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyTemplates({ agencyId: "a1" }, { fetchImpl, env, getWebsiteUrl: site("http://delta.mk") })
    assert.equal(calls.length, 0)
})

test("posts payload to the agency website with the secret header", async () => {
    const { calls, fetchImpl } = recordingFetch()
    await notifyTemplates(
        { agencyId: "a1", propertyId: "p1", scope: "agency" },
        { fetchImpl, env, getWebsiteUrl: site("https://delta.mk") }
    )
    assert.equal(calls.length, 1)
    const [url, init] = calls[0]
    assert.equal(url, "https://delta.mk/api/revalidate")
    assert.equal(init.headers["x-revalidate-secret"], "s3cret")
    assert.deepEqual(JSON.parse(init.body), { agencyId: "a1", propertyId: "p1", scope: "agency" })
})

test("never rejects on network error", async () => {
    const { fetchImpl } = recordingFetch(async () => {
        throw new DOMException("timed out", "TimeoutError")
    })
    await assert.doesNotReject(
        notifyTemplates({ agencyId: "a1" }, { fetchImpl, env, getWebsiteUrl: site("https://delta.mk") })
    )
})

test("never rejects when the website lookup fails", async () => {
    const { calls, fetchImpl } = recordingFetch()
    const getWebsiteUrl = async () => {
        throw new Error("db down")
    }
    await assert.doesNotReject(notifyTemplates({ agencyId: "a1" }, { fetchImpl, env, getWebsiteUrl }))
    assert.equal(calls.length, 0)
})
