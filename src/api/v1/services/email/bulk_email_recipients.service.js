import prisma from "#database/client.js"
import { ROUTE_URL } from "#shared/property_rules/route_url.js"
import { createAgencyEmailUnsubscribeToken } from "./agency_email_unsubscribe.js"

/**
 * Who of the typed/selected addresses still wants Imotko emails, and which opt-out link each one gets.
 * Port of imotko's src/lib/email/admin_email_recipient_resolver.js; the rules are unchanged.
 *
 * @module services/email/bulk_email_recipients
 */

const LINK_LOCALE = "mk"
const CLIENT_EMAIL_UNSUBSCRIBE = "/otkazi-izvestuvanja"
const MANAGER_ROLES = new Set(["manager", "admin"])

const recipientSelect = {
    id: true,
    email: true,
    role: true,
    client: { select: { receiveCompanyEmail: true, chatEmailsUnsubscribeToken: true } },
    agency: { select: { id: true, ownerId: true, emailNotificationsEnabled: true } },
    ownedAgency: { select: { id: true, ownerId: true, emailNotificationsEnabled: true } },
    agencyMember: {
        select: {
            userId: true,
            agencyId: true,
            role: true,
            status: true,
            agency: { select: { id: true, ownerId: true, emailNotificationsEnabled: true } },
        },
    },
}

const agenciesOf = user => {
    const byId = new Map()
    ;[user.agency, user.ownedAgency, user.agencyMember?.agency].forEach(agency => {
        if (agency?.id) byId.set(agency.id, agency)
    })
    return [...byId.values()]
}

const canManageAgencyEmails = (agency, user) => {
    if (agency.ownerId === user.id) return true
    const member = user.agencyMember
    return (
        member?.agencyId === agency.id &&
        member?.userId === user.id &&
        member?.status === "active" &&
        MANAGER_ROLES.has(member?.role)
    )
}

const agencyLinkFor = (user, agencies, appUrl, secret) => {
    const managed = agencies.find(agency => canManageAgencyEmails(agency, user))
    const token = managed ? createAgencyEmailUnsubscribeToken(managed.id, secret) : null
    return token ? `${appUrl}/${LINK_LOCALE}${ROUTE_URL.AGENCY_EMAIL_UNSUBSCRIBE}/${token}` : ""
}

const clientLinkFor = (user, appUrl) => {
    const token = user.client?.chatEmailsUnsubscribeToken
    return token ? `${appUrl}/${LINK_LOCALE}${CLIENT_EMAIL_UNSUBSCRIBE}/${token}` : ""
}

/**
 * Addresses without an account are kept with no link (the admin typed them on purpose), and so are admins.
 * Anyone whose client account or any of whose agencies opted out is excluded.
 *
 * @param {string[]} emails - Normalized, unique addresses
 * @param {{ db?: typeof prisma, appUrl: string, secret?: string }} options
 * @returns {Promise<{ recipients: { email: string, unsubscribeLink: string }[], excluded: string[] }>}
 */
export const resolveBulkEmailRecipients = async (
    emails,
    { db = prisma, appUrl, secret = process.env.EMAIL_UNSUBSCRIBE_SECRET }
) => {
    const users = emails.length
        ? await db.user.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: recipientSelect })
        : []
    const userByEmail = new Map(users.map(user => [user.email.toLowerCase(), user]))

    const recipients = []
    const excluded = []
    let agencyLinkMissing = false

    for (const email of emails) {
        const user = userByEmail.get(email.toLowerCase())
        if (!user) {
            recipients.push({ email, unsubscribeLink: "" })
            continue
        }
        if (user.role === "ADMIN") {
            recipients.push({ email: user.email, unsubscribeLink: "" })
            continue
        }

        const agencies = agenciesOf(user)
        const agencyOptedOut = agencies.some(agency => agency.emailNotificationsEnabled === false)
        if (agencyOptedOut || user.client?.receiveCompanyEmail === false) {
            excluded.push(user.email)
            continue
        }

        if (agencies.length && !secret) agencyLinkMissing = true
        const unsubscribeLink = agencies.length ? agencyLinkFor(user, agencies, appUrl, secret) : clientLinkFor(user, appUrl)
        recipients.push({ email: user.email, unsubscribeLink })
    }

    if (agencyLinkMissing) {
        console.warn("[bulkEmail] EMAIL_UNSUBSCRIBE_SECRET is not set; agency recipients get no opt-out link")
    }
    return { recipients, excluded }
}
