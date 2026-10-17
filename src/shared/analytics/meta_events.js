// COPIED FROM imotko/src/lib/analytics/meta_events.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

// Meta (Pixel + Conversions API) event names, ids and value maps for the owner listing funnel. Shared with
// imotko-express by scripts/export_property_rules.mjs, so keep it free of Next/browser imports.
export const META_EVENTS = Object.freeze({
    VIEW_CONTENT: "ViewContent",
    LISTING_WIZARD_STARTED: "ListingWizardStarted",
    LISTING_STEP_COMPLETED: "ListingStepCompleted",
    OWNER_LISTING_SIGNUP_STARTED: "OwnerListingSignupStarted",
    REGISTRATION_SUBMITTED: "RegistrationSubmitted",
    COMPLETE_REGISTRATION: "CompleteRegistration",
    PROPERTY_SUBMITTED: "PropertySubmitted",
    PROPERTY_PUBLISHED: "PropertyPublished",
    PROPERTY_FIRST_CONTACT: "PropertyFirstContact",
    AGENCY_REGISTRATION_COMPLETED: "AgencyRegistrationCompleted",
    CLIENT_REGISTRATION_COMPLETED: "ClientRegistrationCompleted",
})

// Browser and server send the same id so Meta can drop the duplicate.
export const metaEventId = Object.freeze({
    wizardStarted: distinctId => `wizard-started:${distinctId}`,
    registration: userId => `registration:${userId}`,
    propertySubmitted: propertyId => `property-submitted:${propertyId}`,
    propertyPublished: propertyId => `property-published:${propertyId}`,
    propertyFirstContact: propertyId => `property-first-contact:${propertyId}`,
})

const LISTING_TYPES = { for_sale: "sale", for_rent: "long_term_rent", short_term_rent: "nightly" }
const PROPERTY_TYPES = { flat: "apartment", house: "house", land: "land" }

export const toMetaListingType = listingType => LISTING_TYPES[listingType] ?? null

export const toMetaPropertyType = type => (type ? (PROPERTY_TYPES[type] ?? "other") : null)

export const PHASE_STEP_NAMES = Object.freeze({ 1: "details", 2: "highlights", 3: "pricing" })

export const LISTING_FLOWS = Object.freeze({ OWNER: "owner", HOST: "host", DIRECT: "direct" })

// Unknown values are left out instead of sent as null.
export const buildListingMetaData = ({ listingType, type, flow }) =>
    Object.fromEntries(
        Object.entries({
            listing_type: toMetaListingType(listingType),
            property_type: toMetaPropertyType(type),
            flow: flow || LISTING_FLOWS.DIRECT,
        }).filter(([, value]) => value != null)
    )
