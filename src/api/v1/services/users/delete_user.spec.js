import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { deleteUserService } from "./users.service.js"

const originals = {
    userFindUnique: prisma.user.findUnique,
    transaction: prisma.$transaction,
    deleteUser: supabaseAdmin.auth.admin.deleteUser,
}
afterEach(() => {
    prisma.user.findUnique = originals.userFindUnique
    prisma.$transaction = originals.transaction
    supabaseAdmin.auth.admin.deleteUser = originals.deleteUser
})

// Review Focus 5
test("retires private listings before closing chats and deleting the user", async () => {
    const order = []
    prisma.user.findUnique = async () => ({ id: "u1", supabaseUserId: "s1" })
    supabaseAdmin.auth.admin.deleteUser = async () => ({ error: null })
    prisma.$transaction = async fn =>
        fn({
            client: { findUnique: async () => ({ id: "c1" }) },
            property: { updateMany: async () => (order.push("retire listings"), { count: 1 }) },
            agency: { deleteMany: async () => (order.push("delete agency request"), { count: 0 }) },
            conversationParticipant: { findMany: async () => (order.push("close chats"), []) },
            user: { delete: async () => order.push("delete user") },
        })

    await deleteUserService("u1", { type: "client", userId: "u1" }, "s1")
    assert.deepEqual(order, ["retire listings", "delete agency request", "close chats", "delete user"])
})
