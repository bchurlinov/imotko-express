import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { getPropertiesService, getPropertyService } from "./properties.service.js"
import { FEATURED_ROTATION_MS, featuredIdsForPage } from "./utils/featuredPagination.js"
import { resolveCityLocationIds } from "./utils/queryHelpers.js"

const originalPropertyCount = prisma.property.count
const originalPropertyFindMany = prisma.property.findMany
const originalLocationFindFirst = prisma.propertyLocation.findFirst
const originalLocationFindMany = prisma.propertyLocation.findMany
const originalPropertyFindUnique = prisma.property.findUnique
const originalPropertyViewCreate = prisma.propertyView.create

afterEach(() => {
    prisma.property.count = originalPropertyCount
    prisma.property.findMany = originalPropertyFindMany
    prisma.propertyLocation.findFirst = originalLocationFindFirst
    prisma.propertyLocation.findMany = originalLocationFindMany
    prisma.property.findUnique = originalPropertyFindUnique
    prisma.propertyView.create = originalPropertyViewCreate
})

test("puts active promoted properties first and reserves twelve regular slots", async () => {
    const countQueries = []
    const findManyQueries = []

    prisma.property.count = async query => {
        countQueries.push(query)
        return countQueries.length === 1 ? 2 : 20
    }

    prisma.property.findMany = async query => {
        findManyQueries.push(query)

        if (query.select?.id) {
            return [{ id: "promoted-a" }, { id: "promoted-b" }, { id: "promoted-c" }, { id: "promoted-d" }]
        }

        if (query.where?.id?.in) {
            return [...query.where.id.in].reverse().map(id => ({ id, featured: true }))
        }

        return [
            { id: "expired", featured: true },
            { id: "regular", featured: false },
        ]
    }

    const result = await getPropertiesService({ price_from: "100000", page: "1" })

    assert.equal(result.data.length, 5)
    assert.ok(result.data.slice(0, 3).every(property => property.id.startsWith("promoted-")))
    assert.deepEqual(
        result.data.slice(3).map(property => property.id),
        ["expired", "regular"]
    )
    assert.ok(result.data.slice(3).every(property => property.featured === false))
    assert.deepEqual(result.pagination, {
        currentPage: 1,
        pageSize: 15,
        totalPages: 2,
        total: 2,
        hasMore: true,
    })

    const promotedIdQuery = findManyQueries.find(query => query.select?.id)
    assert.equal(promotedIdQuery.where.price, undefined)
    assert.equal(promotedIdQuery.where.OR, undefined)
    assert.deepEqual(promotedIdQuery.orderBy, { id: "asc" })
    assert.ok(promotedIdQuery.where.AND.some(condition => condition.featured === true))

    const normalQuery = findManyQueries.find(query => query.take === 12)
    assert.equal(normalQuery.skip, 0)
    assert.ok(normalQuery.where.AND.some(condition => condition.OR?.some(branch => branch.featured === false)))
})

test("falls back to page one when the requested promoted search page is out of range", async () => {
    let countCall = 0
    let normalQuery

    prisma.property.count = async () => {
        countCall += 1
        return countCall === 1 ? 10 : 13
    }

    prisma.property.findMany = async query => {
        if (query.select?.id) return [{ id: "promoted-a" }, { id: "promoted-b" }, { id: "promoted-c" }]
        if (query.where?.id?.in) return query.where.id.in.map(id => ({ id, featured: true }))

        normalQuery = query
        return []
    }

    const result = await getPropertiesService({ page: "999" })

    assert.equal(result.pagination.currentPage, 1)
    assert.equal(result.pagination.totalPages, 2)
    assert.equal(normalQuery.skip, 0)
})

test("widens a municipality to its whole city for promoted results", async () => {
    prisma.propertyLocation.findFirst = async () => ({ id: "karpos", parentId: "skopje" })
    prisma.propertyLocation.findMany = async () => [{ id: "karpos" }, { id: "centar" }, { id: "aerodrom" }]

    const ids = await resolveCityLocationIds("skopje-karpos")

    assert.deepEqual(ids, ["skopje", "karpos", "centar", "aerodrom"])
})

test("keeps promoted shuffling stable within the hour and advances it across pages", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"]
    const nowMs = FEATURED_ROTATION_MS * 100

    const firstPage = featuredIdsForPage(ids, 1, nowMs)
    const repeatedFirstPage = featuredIdsForPage(ids, 1, nowMs + FEATURED_ROTATION_MS - 1)
    const secondPage = featuredIdsForPage(ids, 2, nowMs)

    assert.deepEqual(repeatedFirstPage, firstPage)
    assert.equal(firstPage.length, 3)
    assert.equal(secondPage.length, 3)
    assert.equal(
        firstPage.some(id => secondPage.includes(id)),
        false
    )
})

const hasExclusion = where => (where.AND || []).some(condition => condition.listingType?.not === "short_term_rent")

test("legacy search and promoted queries leave out short-term rent", async () => {
    const countQueries = []
    const findManyQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async query => {
        findManyQueries.push(query)
        return []
    }

    await getPropertiesService({ page: "1" })

    assert.ok(countQueries.every(query => hasExclusion(query.where)))
    const promotedIdQuery = findManyQueries.find(query => query.select?.id)
    assert.ok(hasExclusion(promotedIdQuery.where))
})

test("an explicit short-term search from a legacy caller cannot match anything", async () => {
    const countQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async () => []

    await getPropertiesService({ listingType: "short_term_rent", page: "1" })

    const where = countQueries[0].where
    assert.equal(where.listingType, "short_term_rent")
    assert.ok(where.AND.some(condition => condition.listingType?.not === "short_term_rent"))
})

test("callers with the capability are not filtered, and guests filters maxGuests", async () => {
    const countQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async () => []

    await getPropertiesService({ guests: "4", page: "1" }, { capabilities: { shortTermRent: true } })

    assert.ok(countQueries.every(query => !hasExclusion(query.where)))
    assert.deepEqual(countQueries[0].where.maxGuests, { gte: 4 })
})

test("junk guests values are ignored", async () => {
    const countQueries = []
    prisma.property.count = async query => {
        countQueries.push(query)
        return 0
    }
    prisma.property.findMany = async () => []

    await getPropertiesService({ guests: "abc", page: "1" })
    await getPropertiesService({ guests: "0", page: "1" })

    assert.ok(countQueries.every(query => query.where.maxGuests === undefined))
})

test("a short-term listing opened by id looks missing to a legacy caller", async () => {
    let viewRecorded = false
    prisma.property.findUnique = async () => ({ id: "p1", agencyId: "a1", listingType: "short_term_rent" })
    prisma.propertyView.create = async () => {
        viewRecorded = true
    }

    const legacy = await getPropertyService("p1", {})
    assert.equal(legacy.data, null)
    assert.equal(viewRecorded, false)

    const templates = await getPropertyService("p1", {}, { capabilities: { shortTermRent: true } })
    assert.equal(templates.data.id, "p1")
})
