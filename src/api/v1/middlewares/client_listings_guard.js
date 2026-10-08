import { resolveChatViewer } from "#middlewares/resolveChatViewer.js"
import { ClientListingError } from "#shared/property_rules/client_listing_error.js"
import { CLIENT_LISTING_ERRORS } from "#shared/property_rules/client_listings_constants.js"
import { getClientByUser } from "#shared/property_rules/client_properties_data.js"

// /client/* and /uploads/* exist only for apps with client listings: older callers get 404 before auth.
export const requireClientListingsCapability = (req, res, next) =>
    req.capabilities?.clientListings ? next() : next(new ClientListingError(CLIENT_LISTING_ERRORS.NOT_FOUND, 404))

export const requireClientAccount = async (req, res, next) => {
    try {
        if (req.chatViewer?.type !== "client") throw new ClientListingError(CLIENT_LISTING_ERRORS.FORBIDDEN, 403)
        const client = await getClientByUser(req.chatViewer.userId)
        if (!client) throw new ClientListingError(CLIENT_LISTING_ERRORS.FORBIDDEN, 403)
        req.client = client
        return next()
    } catch (error) {
        return next(error)
    }
}

export const clientListingsGuard = [requireClientListingsCapability, resolveChatViewer, requireClientAccount]
