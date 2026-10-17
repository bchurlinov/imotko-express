import assert from "node:assert/strict"
import test from "node:test"
import { afterClientListingCreated, readExpressRequestContext, scheduleClientListingConversions } from "./client_listing_tracking.service.js"

const property = { id: "p1", listingType: "for_sale", type: "flat" }
const req = {
    headers: {},
    get: name => ({ "user-agent": "okhttp/4.12", "x-forwarded-for": "9.9.9.9, 1.1.1.1" })[name],
}

const makeDeps = ({ user = { id: "u1", email: "ana@x.mk" }, failLookup = false } = {}) => {
    const calls = { track: [], backfill: [], lookups: [] }
    return {
        calls,
        deps: {
            db: {
                user: {
                    findUnique: async args => {
                        calls.lookups.push(args)
                        if (failLookup) throw new Error("db down")
                        return user
                    },
                },
                $transaction: async fn => fn("tx"),
            },
            track: args => calls.track.push(args),
            backfill: async (tx, args) => calls.backfill.push({ tx, args }),
        },
    }
}

test("the app's context has the ip and user agent but no browser cookies", () => {
    assert.deepEqual(readExpressRequestContext(req), {
        fbp: null,
        fbc: null,
        clientIpAddress: "9.9.9.9",
        clientUserAgent: "okhttp/4.12",
        eventSourceUrl: null,
    })
})

test("tracks PropertySubmitted as a system event and fills the empty location", async () => {
    const { calls, deps } = makeDeps()

    await afterClientListingCreated({ property, userId: "u1", clientId: "c1", city: "skopje", req }, deps)

    assert.deepEqual(calls.lookups, [{ where: { id: "u1" }, select: { id: true, email: true } }])
    assert.equal(calls.track.length, 1)
    assert.equal(calls.track[0].actionSource, "system_generated")
    assert.deepEqual(calls.track[0].user, { id: "u1", email: "ana@x.mk" })
    assert.equal(calls.track[0].requestContext.clientUserAgent, "okhttp/4.12")
    assert.deepEqual(calls.backfill, [{ tx: "tx", args: { userId: "u1", clientId: "c1", city: "skopje" } }])
})

test("tracking failure does not affect the response", async () => {
    const { deps } = makeDeps({ failLookup: true })
    const original = console.error
    let logged = false
    console.error = () => {
        logged = true
    }

    try {
        await afterClientListingCreated({ property, userId: "u1", clientId: "c1", city: "skopje", req }, deps)
    } finally {
        console.error = original
    }

    assert.equal(logged, true)
})

test("scheduling defers the work and never throws", () => {
    let deferred
    let ran

    scheduleClientListingConversions(
        { property },
        { run: args => (ran = args), defer: fn => (deferred = fn) }
    )
    assert.equal(ran, undefined)
    deferred()

    assert.deepEqual(ran, { property })
    assert.doesNotThrow(() =>
        scheduleClientListingConversions(
            {},
            {
                run: () => {
                    throw new Error("x")
                },
                defer: fn => fn(),
            }
        )
    )
})
