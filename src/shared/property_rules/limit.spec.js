import assert from "node:assert/strict"
import test from "node:test"
import { assertBelowListingLimit } from "./limit.js"

const makeTx = count => {
    const calls = { lock: 0, count: 0 }
    return {
        calls,
        $executeRaw: async () => {
            calls.lock += 1
            return 1
        },
        property: {
            count: async () => {
                calls.count += 1
                return count
            },
        },
    }
}

test("sale and rent stop at the per-type limit", async () => {
    for (const listingType of ["for_sale", "for_rent"]) {
        await assert.doesNotReject(() => assertBelowListingLimit(makeTx(4), "c1", listingType))
        await assert.rejects(() => assertBelowListingLimit(makeTx(5), "c1", listingType), {
            code: "clientListingLimitReached",
            status: 409,
        })
    }
})

test("short-term rent is unlimited and skips the lock and count", async () => {
    const tx = makeTx(50)
    await assert.doesNotReject(() => assertBelowListingLimit(tx, "c1", "short_term_rent"))
    assert.deepEqual(tx.calls, { lock: 0, count: 0 })
})
