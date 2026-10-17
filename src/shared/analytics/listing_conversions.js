// COPIED FROM imotko/src/lib/owner_listing/listing_conversions.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { ANALYTICS_EVENTS } from "./events.js"
import { buildListingMetaData, META_EVENTS, metaEventId } from "./meta_events.js"
import { captureMetaConversion } from "./meta_conversion.js"

// Server-side conversions for private (client) listings. Shared with imotko-express by
// scripts/export_property_rules.mjs, so it imports nothing from Next. Callers fire these without awaiting.

// `actionSource` is "website" for the web wizard (with its request context) and "system_generated" for the mobile app.
export const trackListingSubmitted = ({ property, user, requestContext = null, actionSource }) =>
    captureMetaConversion({
        distinctId: user.id,
        event: ANALYTICS_EVENTS.CLIENT_LISTING_SUBMITTED,
        metaEventName: META_EVENTS.PROPERTY_SUBMITTED,
        metaEventId: metaEventId.propertySubmitted(property.id),
        actionSource,
        user,
        requestContext,
        customData: buildListingMetaData({ listingType: property.listingType, type: property.type }),
    })

// Only the first approval counts: Property.firstPublishedAt is set once, so a re-approval after an edit sees it filled.
export const trackListingPublished = ({ property, user, previousFirstPublishedAt }) => {
    if (previousFirstPublishedAt || !user?.id) return

    captureMetaConversion({
        distinctId: user.id,
        event: ANALYTICS_EVENTS.CLIENT_LISTING_PUBLISHED,
        metaEventName: META_EVENTS.PROPERTY_PUBLISHED,
        metaEventId: metaEventId.propertyPublished(property.id),
        actionSource: "system_generated",
        user,
        customData: buildListingMetaData({ listingType: property.listingType, type: property.type }),
    })
}

const EMPTY_LOCATION = [{ location: null }, { location: "" }]

// Owners sign up without a location; the city of their first listing becomes it. Only empty values are filled.
export const backfillUserLocationFromListing = async (tx, { userId, clientId, city }) => {
    if (!city) return

    await tx.user.updateMany({ where: { id: userId, OR: EMPTY_LOCATION }, data: { location: city } })
    if (clientId) {
        await tx.client.updateMany({ where: { id: clientId, OR: EMPTY_LOCATION }, data: { location: city } })
    }
}
