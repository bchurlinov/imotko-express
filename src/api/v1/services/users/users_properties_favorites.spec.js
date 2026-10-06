import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import {
    getPropertiesFavoritesService,
    usersCreatePropertiesFavoriteService,
} from "./users_properties_favorites.service.js"

const originals = {
    clientFindUnique: prisma.client.findUnique,
    propertyFindUnique: prisma.property.findUnique,
    favoriteFindMany: prisma.propertyFavorite.findMany,
    favoriteFindFirst: prisma.propertyFavorite.findFirst,
}

afterEach(() => {
    prisma.client.findUnique = originals.clientFindUnique
    prisma.property.findUnique = originals.propertyFindUnique
    prisma.propertyFavorite.findMany = originals.favoriteFindMany
    prisma.propertyFavorite.findFirst = originals.favoriteFindFirst
})

test("legacy callers do not get short-term favorites", async () => {
    let where
    prisma.client.findUnique = async () => ({ id: "client_1" })
    prisma.propertyFavorite.findMany = async query => {
        where = query.where
        return []
    }

    await getPropertiesFavoritesService("user_1")
    assert.deepEqual(where, {
        clientId: "client_1",
        property: { AND: [{ listingType: { not: "short_term_rent" } }, { clientId: null }] },
    })

    await getPropertiesFavoritesService("user_1", { shortTermRent: true, clientListings: true })
    assert.deepEqual(where, { clientId: "client_1" })
})

test("a legacy caller cannot favorite a short-term listing", async () => {
    prisma.client.findUnique = async () => ({ id: "client_1" })
    prisma.property.findUnique = async () => ({ id: "p1", listingType: "short_term_rent" })
    prisma.propertyFavorite.findFirst = async () => {
        throw new Error("must not get this far")
    }

    await assert.rejects(() => usersCreatePropertiesFavoriteService("user_1", "p1", "1.1.1.1"), { status: 404 })
})

test("legacy callers cannot favorite a private listing", async () => {
    prisma.client.findUnique = async () => ({ id: "client_1" })
    prisma.property.findUnique = async () => ({ id: "p1", listingType: "for_sale", clientId: "c9" })
    await assert.rejects(() => usersCreatePropertiesFavoriteService("user_1", "p1", "127.0.0.1"), { status: 404 })
})
