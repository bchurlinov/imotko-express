import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { getDemandAnalyticsService, getPricePerSqmService, getPriceTrendsService } from "./analytics.service.js"

const originalQueryRaw = prisma.$queryRawUnsafe

afterEach(() => {
    prisma.$queryRawUnsafe = originalQueryRaw
})

const captureSql = () => {
    const calls = []
    prisma.$queryRawUnsafe = async (sql, ...params) => {
        calls.push({ sql, params })
        return []
    }
    return calls
}

test("nightly prices never enter price statistics", async () => {
    for (const service of [getPriceTrendsService, getPricePerSqmService]) {
        const calls = captureSql()
        const result = await service({ listingType: "short_term_rent" })
        assert.deepEqual(result, { success: false, status: 400, error: "unsupportedListingType" })
        assert.equal(calls.length, 0)
    }
})

test("without a listing type only sale and long-term rent are averaged", async () => {
    for (const service of [getPriceTrendsService, getPricePerSqmService]) {
        const calls = captureSql()
        await service({})
        assert.match(calls[0].sql, /"listingType"::text IN \('for_sale', 'for_rent'\)/)
    }
})

test("an explicit sale or rent listing type still works as before", async () => {
    const calls = captureSql()
    await getPriceTrendsService({ listingType: "for_rent" })
    assert.ok(calls[0].params.includes("for_rent"))
    assert.doesNotMatch(calls[0].sql, /IN \('for_sale', 'for_rent'\)/)
})

test("short-term listings never enter demand analytics", async () => {
    const calls = captureSql()
    const result = await getDemandAnalyticsService({ listingType: "short_term_rent" })

    assert.deepEqual(result, { success: false, status: 400, error: "unsupportedListingType" })
    assert.equal(calls.length, 0)
})

test("demand analytics only includes sale and long-term rent by default", async () => {
    const calls = captureSql()
    await getDemandAnalyticsService({})

    assert.match(calls[0].sql, /"listingType"::text IN \('for_sale', 'for_rent'\)/)
})

test("price trends for a city include listings in its child areas", async () => {
    const originalFindUnique = prisma.propertyLocation.findUnique
    prisma.propertyLocation.findUnique = async () => ({ id: "skopje-id" })
    try {
        const calls = captureSql()
        await getPriceTrendsService({ locationId: "skopje", listingType: "for_sale" })

        assert.match(calls[0].sql, /mt\."propertyLocationId" = \$3 OR mt\."parentLocationId" = \$3/)
        assert.equal(calls[0].params[2], "skopje-id")
    } finally {
        prisma.propertyLocation.findUnique = originalFindUnique
    }
})
