import prisma from "#database/client.js"
import { resolveChatViewer } from "#middlewares/resolveChatViewer.js"
import { CHAT_ERRORS } from "#services/chat/chat_constants.js"
import { ChatError } from "#services/chat/chat_error.js"
import { ClientListingError } from "#shared/property_rules/client_listing_error.js"
import { CLIENT_LISTING_ERRORS } from "#shared/property_rules/client_listings_constants.js"
import { getClientByUser } from "#shared/property_rules/client_properties_data.js"

// The app turns 403 "forbidden" from /client/* into "your account is now an agency, sign out", so only agency accounts
// get that code. Anything else that keeps a person out (admins, a login whose email belongs to another user) gets a
// code the app shows as a plain error toast instead.
export const CLIENT_ACCOUNT_UNAVAILABLE = "unauthorized"
export const accountUnavailableError = () => new ClientListingError(CLIENT_ACCOUNT_UNAVAILABLE, 403)

// /client/* and /uploads/* exist only for apps with client listings: older callers get 404 before auth.
export const requireClientListingsCapability = (req, res, next) =>
    req.capabilities?.clientListings ? next() : next(new ClientListingError(CLIENT_LISTING_ERRORS.NOT_FOUND, 404))

export const remapViewerError = error =>
    error instanceof ChatError && error.code === CHAT_ERRORS.FORBIDDEN && !error.agencyAccount
        ? accountUnavailableError()
        : error

export const resolveClientViewer = (req, res, next) =>
    resolveChatViewer(req, res, error => next(remapViewerError(error)))

// Every CLIENT user is created with a client row; one that lost it gets it back instead of being locked out.
export const ensureClientForUser = async userId => {
    const existing = await getClientByUser(userId)
    if (existing) return existing
    const client = await prisma.client.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true, credits: true },
    })
    await prisma.user.updateMany({
        where: { id: userId, OR: [{ clientId: null }, { clientId: { not: client.id } }] },
        data: { clientId: client.id },
    })
    return client
}

export const requireClientAccount = async (req, res, next) => {
    try {
        const type = req.chatViewer?.type
        if (type === "agency") throw new ClientListingError(CLIENT_LISTING_ERRORS.FORBIDDEN, 403)
        if (type !== "client") throw accountUnavailableError()
        req.client = await ensureClientForUser(req.chatViewer.userId)
        return next()
    } catch (error) {
        return next(error)
    }
}

export const clientListingsGuard = [requireClientListingsCapability, resolveClientViewer, requireClientAccount]
