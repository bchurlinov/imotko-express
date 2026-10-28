import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { deleteUserService } from "./users.service.js"

const originals = {
    userFindUnique: prisma.user.findUnique,
    agencyFindFirst: prisma.agency.findFirst,
    transaction: prisma.$transaction,
    deleteUser: supabaseAdmin.auth.admin.deleteUser,
}
afterEach(() => {
    prisma.user.findUnique = originals.userFindUnique
    prisma.agency.findFirst = originals.agencyFindFirst
    prisma.$transaction = originals.transaction
    supabaseAdmin.auth.admin.deleteUser = originals.deleteUser
})

// Review Focus 5
test("retires private listings before closing chats and deleting the user", async () => {
    const order = []
    prisma.user.findUnique = async () => ({ id: "u1", supabaseUserId: "s1" })
    prisma.agency.findFirst = async () => null
    supabaseAdmin.auth.admin.deleteUser = async () => ({ error: null })
    prisma.$transaction = async fn =>
        fn({
            client: { findUnique: async () => ({ id: "c1" }) },
            property: { updateMany: async () => (order.push("retire listings"), { count: 1 }) },
            agency: { deleteMany: async () => (order.push("delete agency request"), { count: 0 }) },
            agencyMember: { findUnique: async () => (order.push("find member"), null) },
            conversationParticipant: { findMany: async () => (order.push("close chats"), []) },
            user: { delete: async () => order.push("delete user") },
        })

    await deleteUserService("u1", { type: "client", userId: "u1" }, "s1")
    assert.deepEqual(order, ["retire listings", "delete agency request", "find member", "close chats", "delete user"])
})

test("hands an agency member's CRM notes to the agency owner before deleting the user", async () => {
    const order = []
    prisma.user.findUnique = async () => ({ id: "u1", supabaseUserId: "s1" })
    prisma.agency.findFirst = async () => null
    supabaseAdmin.auth.admin.deleteUser = async () => ({ error: null })
    let notesUpdate
    prisma.$transaction = async fn =>
        fn({
            client: { findUnique: async () => null },
            agency: { deleteMany: async () => ({ count: 0 }) },
            agencyMember: {
                findUnique: async ({ where }) =>
                    where.userId === "u1"
                        ? { id: "m1", agencyId: "a1", agency: { ownerId: "owner" } }
                        : { id: "m-owner" },
            },
            agencyClientNotes: {
                updateMany: async args => ((notesUpdate = args), order.push("hand over notes"), { count: 2 }),
            },
            conversationParticipant: { findMany: async () => [] },
            user: { delete: async () => order.push("delete user") },
        })

    await deleteUserService("u1", { type: "client", userId: "u1" }, "s1")
    assert.deepEqual(notesUpdate, { where: { createdById: "m1" }, data: { createdById: "m-owner" } })
    assert.deepEqual(order, ["hand over notes", "delete user"])
})

test("refuses to delete an agency owner before the Supabase login is touched", async () => {
    let supabaseCalled = false
    prisma.user.findUnique = async () => ({ id: "u1", supabaseUserId: "s1" })
    prisma.agency.findFirst = async () => ({ id: "a1", name: "Agency" })
    supabaseAdmin.auth.admin.deleteUser = async () => ((supabaseCalled = true), { error: null })

    await assert.rejects(deleteUserService("u1", { type: "client", userId: "u1" }, "s1"), { status: 409 })
    assert.equal(supabaseCalled, false)
})
