import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createAgencyEmailUnsubscribeToken } from "./agency_email_unsubscribe.js"
import { resolveBulkEmailRecipients } from "./bulk_email_recipients.service.js"

const APP_URL = "https://imotko.mk"
const SECRET = "shared"

const agency = (overrides = {}) => ({ id: "ag1", ownerId: "owner", emailNotificationsEnabled: true, ...overrides })
const user = (overrides = {}) => ({
    id: "u1",
    email: "client@x.mk",
    role: "CLIENT",
    client: { receiveCompanyEmail: true, chatEmailsUnsubscribeToken: "t1" },
    agency: null,
    ownedAgency: null,
    agencyMember: null,
    ...overrides,
})

const resolve = async (emails, users, secret = SECRET) => {
    const calls = []
    const db = { user: { findMany: async args => (calls.push(args), users) } }
    const result = await resolveBulkEmailRecipients(emails, { db, appUrl: APP_URL, secret })
    return { ...result, calls }
}

const agencyLink = `${APP_URL}/mk/agencija/otkazi-izvestuvanja/${createAgencyEmailUnsubscribeToken("ag1", SECRET)}`

describe("resolveBulkEmailRecipients", () => {
    it("matches addresses to accounts case-insensitively and links the client", async () => {
        const { recipients, excluded, calls } = await resolve(["client@x.mk"], [user({ email: "Client@X.mk" })])

        assert.deepEqual(recipients, [
            { email: "Client@X.mk", unsubscribeLink: `${APP_URL}/mk/otkazi-izvestuvanja/t1` },
        ])
        assert.deepEqual(excluded, [])
        assert.deepEqual(calls[0].where, { email: { in: ["client@x.mk"], mode: "insensitive" } })
    })

    it("keeps an address without an account, with no link", async () => {
        const { recipients } = await resolve(["guest@x.mk"], [])
        assert.deepEqual(recipients, [{ email: "guest@x.mk", unsubscribeLink: "" }])
    })

    it("keeps admins, with no link", async () => {
        const { recipients } = await resolve(["admin@x.mk"], [user({ email: "admin@x.mk", role: "ADMIN" })])
        assert.deepEqual(recipients, [{ email: "admin@x.mk", unsubscribeLink: "" }])
    })

    it("excludes an opted-out client", async () => {
        const { recipients, excluded } = await resolve(
            ["client@x.mk"],
            [user({ client: { receiveCompanyEmail: false, chatEmailsUnsubscribeToken: "t1" } })]
        )
        assert.deepEqual(recipients, [])
        assert.deepEqual(excluded, ["client@x.mk"])
    })

    it("excludes a member of an agency that turned notifications off", async () => {
        const { excluded } = await resolve(
            ["agent@a.mk"],
            [user({ email: "agent@a.mk", role: "AGENCY", client: null, agency: agency({ emailNotificationsEnabled: false }) })]
        )
        assert.deepEqual(excluded, ["agent@a.mk"])
    })

    it("gives the agency link to the owner and an active manager, but not to an agent", async () => {
        const owner = user({ id: "owner", email: "owner@a.mk", role: "AGENCY", client: null, ownedAgency: agency() })
        const manager = user({
            id: "m1",
            email: "manager@a.mk",
            role: "AGENCY",
            client: null,
            agencyMember: { userId: "m1", agencyId: "ag1", role: "manager", status: "active", agency: agency() },
        })
        const agent = user({
            id: "a1",
            email: "agent@a.mk",
            role: "AGENCY",
            client: null,
            agencyMember: { userId: "a1", agencyId: "ag1", role: "agent", status: "active", agency: agency() },
        })

        const { recipients } = await resolve(["owner@a.mk", "manager@a.mk", "agent@a.mk"], [owner, manager, agent])
        assert.deepEqual(recipients, [
            { email: "owner@a.mk", unsubscribeLink: agencyLink },
            { email: "manager@a.mk", unsubscribeLink: agencyLink },
            { email: "agent@a.mk", unsubscribeLink: "" },
        ])
    })

    it("still sends to agency owners without a link when the shared secret is missing", async () => {
        const owner = user({ id: "owner", email: "owner@a.mk", role: "AGENCY", client: null, ownedAgency: agency() })
        const { recipients } = await resolve(["owner@a.mk"], [owner], "")
        assert.deepEqual(recipients, [{ email: "owner@a.mk", unsubscribeLink: "" }])
    })
})
