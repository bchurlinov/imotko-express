import assert from "node:assert/strict"
import test from "node:test"
import { createResolvePropertyWriter } from "./resolve_property_writer.js"

const run = async (db, req = {}) => {
    const request = { user: { id: "sb-1" }, ...req }
    let nextArg = "not-called"
    await createResolvePropertyWriter({ db })(request, {}, arg => (nextArg = arg))
    return { request, nextArg }
}

const fakeDb = ({ user, member }) => ({
    user: { findUnique: async () => user },
    agencyMember: { findFirst: async () => member },
})

test("unknown user → 403", async () => {
    const { nextArg } = await run(fakeDb({ user: null }))
    assert.equal(nextArg.status, 403)
})

test("admin → admin actor", async () => {
    const { request, nextArg } = await run(fakeDb({ user: { id: "u1", role: "ADMIN", clientId: null } }))
    assert.equal(nextArg, undefined)
    assert.deepEqual(request.actor, { kind: "admin", userId: "u1" })
})

test("active member with write_properties → agency actor with the agency id from the DB", async () => {
    const db = fakeDb({ user: { id: "u1", role: "AGENCY", clientId: null }, member: { agencyId: "a1", role: "admin" } })
    const { request, nextArg } = await run(db, { body: { agencyId: "spoofed" } })
    assert.equal(nextArg, undefined)
    assert.deepEqual(request.actor, { kind: "agency", userId: "u1", agencyId: "a1" })
})

test("member whose role lacks write_properties → 403", async () => {
    const db = fakeDb({ user: { id: "u1", role: "AGENCY", clientId: null }, member: { agencyId: "a1", role: "viewer" } })
    const { nextArg } = await run(db)
    assert.equal(nextArg.status, 403)
})

test("no active membership → 403", async () => {
    const { nextArg } = await run(fakeDb({ user: { id: "u1", role: "AGENCY", clientId: null }, member: null }))
    assert.equal(nextArg.status, 403)
})

test("client with the client-listings capability → client actor", async () => {
    const db = fakeDb({ user: { id: "u2", role: "CLIENT", clientId: "c1" }, member: null })
    const { request } = await run(db, { capabilities: { clientListings: true } })
    assert.deepEqual(request.actor, { kind: "client", userId: "u2", clientId: "c1" })
})

test("client without the capability (web) → 403", async () => {
    const db = fakeDb({ user: { id: "u2", role: "CLIENT", clientId: "c1" }, member: null })
    const { nextArg } = await run(db)
    assert.equal(nextArg.status, 403)
})

test("db failure → passes the error on", async () => {
    const db = { user: { findUnique: async () => Promise.reject(new Error("db down")) } }
    const { nextArg } = await run(db)
    assert.equal(nextArg.message, "db down")
})
