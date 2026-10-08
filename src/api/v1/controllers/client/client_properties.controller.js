import prisma from "#database/client.js"
import { ClientListingError } from "#shared/property_rules/client_listing_error.js"
import {
    CLIENT_LISTING_COUNTED_STATUSES,
    CLIENT_LISTING_ERRORS,
    CLIENT_LISTING_LIMIT_PER_TYPE,
} from "#shared/property_rules/client_listings_constants.js"
import { getClientListingsOverview, getClientPropertyForEdit } from "#shared/property_rules/client_properties_data.js"
import { getClientListingCounts } from "#shared/property_rules/limit.js"
import { clientJson } from "./client_listing_response.js"

export const listClientPropertiesController = async (req, res) => {
    const overview = await getClientListingsOverview(req.chatViewer.userId)
    if (!overview) throw new ClientListingError(CLIENT_LISTING_ERRORS.FORBIDDEN, 403)
    return clientJson(res, 200, null, {
        credits: overview.client.credits,
        limitPerType: CLIENT_LISTING_LIMIT_PER_TYPE,
        counts: overview.counts,
        agencyRequest: overview.agencyRequest,
        properties: overview.properties,
    })
}

export const getClientPropertyController = async (req, res) => {
    const property = await getClientPropertyForEdit(req.client.id, req.params.id)
    if (!property) throw new ClientListingError(CLIENT_LISTING_ERRORS.NOT_FOUND, 404)
    const counts = await getClientListingCounts(prisma, req.client.id)
    if (CLIENT_LISTING_COUNTED_STATUSES.includes(property.status)) counts[property.listingType] -= 1
    return clientJson(res, 200, null, { property, counts })
}
