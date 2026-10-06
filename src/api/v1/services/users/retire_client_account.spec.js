import assert from "node:assert/strict"
import test from "node:test"
import { retireClientAccount } from "./retire_client_account.js"

test("retires every listing and deletes the open agency request", async () => {
    const calls = {}
    const tx = {
        property: {
            updateMany: async args => {
                calls.property = args
                return { count: 2 }
            },
        },
        agency: {
            deleteMany: async args => {
                calls.agency = args
                return { count: 1 }
            },
        },
    }
    assert.deepEqual(await retireClientAccount(tx, { userId: "u1", clientId: "c1" }), {
        listings: 2,
        agencyRequests: 1,
    })
    assert.deepEqual(calls.property, {
        where: { clientId: "c1" },
        data: { status: "DELETED", autoRenewEnabled: false, clientId: null },
    })
    assert.deepEqual(calls.agency, {
        where: { ownerId: "u1", status: { in: ["PENDING", "DECLINED"] }, agencyOwner: { role: "CLIENT" } },
    })
})
