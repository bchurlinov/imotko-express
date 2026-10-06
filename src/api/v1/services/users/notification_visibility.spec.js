import assert from "node:assert/strict"
import test from "node:test"
import { withoutHiddenNotifications } from "./notification_visibility.js"

const rows = [
    { id: "n1", metadata: null },
    { id: "n2", metadata: { link: "/mk/nedviznini/x/1" } },
    { id: "n3", metadata: { feature: "client_listings", link: "/mk/korisnicka-smetka/nedviznosti/1" } },
    { id: "n4", metadata: { link: "/mk/korisnicka-smetka/poraki/c-agency", conversationId: "c-agency" } },
    { id: "n5", metadata: { link: "/mk/korisnicka-smetka/poraki/c-private", conversationId: "c-private" } },
]

const db = queried => ({
    conversation: {
        findMany: async ({ where }) => {
            queried.push(where)
            return where.id.in.includes("c-private") ? [{ id: "c-private" }] : []
        },
    },
})

// Review Focus 3
test("legacy callers lose B's notifications and chat notifications about hidden threads", async () => {
    const queried = []
    const visible = await withoutHiddenNotifications(rows, undefined, db(queried))
    assert.deepEqual(
        visible.map(row => row.id),
        ["n1", "n2", "n4"]
    )
    assert.deepEqual(queried[0], { id: { in: ["c-agency", "c-private"] }, kind: { notIn: ["AGENCY_INQUIRY"] } })
})

test("callers with clientListings get every notification without a query", async () => {
    const queried = []
    const visible = await withoutHiddenNotifications(rows, { clientListings: true }, db(queried))
    assert.equal(visible.length, 5)
    assert.equal(queried.length, 0)
})

test("no conversation query when no notification points at one", async () => {
    const queried = []
    await withoutHiddenNotifications(rows.slice(0, 3), undefined, db(queried))
    assert.equal(queried.length, 0)
})
