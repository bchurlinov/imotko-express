import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { getUserSearchesService } from "./users_searches.service.js"

const originals = {
    userFindUnique: prisma.user.findUnique,
    searchCount: prisma.clientSearch.count,
    searchFindMany: prisma.clientSearch.findMany,
}

afterEach(() => {
    prisma.user.findUnique = originals.userFindUnique
    prisma.clientSearch.count = originals.searchCount
    prisma.clientSearch.findMany = originals.searchFindMany
})

const stub = () => {
    const calls = { count: [], findMany: [] }
    prisma.user.findUnique = async () => ({ id: "user_1", client: { id: "client_1" } })
    prisma.clientSearch.count = async query => {
        calls.count.push(query)
        return 1
    }
    prisma.clientSearch.findMany = async query => {
        calls.findMany.push(query)
        // The positive match only selects ids; the page query returns rows.
        return query.select?.id ? [{ id: "short_term_search" }] : []
    }
    return calls
}

test("legacy callers do not get short-term saved searches, in the list or the total", async () => {
    const calls = stub()

    await getUserSearchesService("user_1", {})

    const [hiddenQuery, pageQuery] = calls.findMany
    // Positive match on the JSON path: searches without a listingType key are never matched (and so never hidden).
    assert.deepEqual(hiddenQuery.where, {
        clientId: "client_1",
        filters: { path: ["listingType"], equals: "short_term_rent" },
    })
    assert.deepEqual(calls.count[0].where, { clientId: "client_1", id: { notIn: ["short_term_search"] } })
    assert.deepEqual(pageQuery.where, { clientId: "client_1", id: { notIn: ["short_term_search"] } })
})

test("callers with the capability get every saved search with no extra query", async () => {
    const calls = stub()

    await getUserSearchesService("user_1", {}, { shortTermRent: true })

    assert.equal(calls.findMany.length, 1)
    assert.deepEqual(calls.count[0].where, { clientId: "client_1" })
})
