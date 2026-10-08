// COPIED FROM imotko/src/lib/client_listings/listing_input.js (without: revalidateClientListing) by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { PropertyStatus } from "#generated/prisma/enums.ts"
import { CLIENT_LISTING_ERRORS } from "./client_listings_constants.js"
import { PropertySchema } from "./property.schema.js"
import { findContactDetailsField } from "./contact_details.js"
import { buildCorePropertyFields, resolvePropertyTaxonomy } from "./property_dto.js"
import { areImagesOwnedOrUnchanged, getImageStorageScopeKey } from "./property_image_storage.js"
import { ClientListingError } from "./client_listing_error.js"

// Validation shared by create and edit. Returns the resolved category/sub category.
export const validateClientListingInput = async ({ body, userId, existing = null }) => {
    await PropertySchema.validate(body, { abortEarly: false, context: { isAdmin: false } })

    const contactField = findContactDetailsField(body)
    if (contactField) {
        throw new ClientListingError(CLIENT_LISTING_ERRORS.CONTACT_DETAILS, 400, {
            [contactField]: CLIENT_LISTING_ERRORS.CONTACT_DETAILS,
        })
    }

    const taxonomy = resolvePropertyTaxonomy(body.type, body.propertySubType)
    if (!taxonomy) throw new ClientListingError("validationFailed", 400)

    // Photos uploaded by a client live in the per-user storage folder; anything else must be unchanged.
    const scope = getImageStorageScopeKey({ userId })
    const imagesAllowed =
        areImagesOwnedOrUnchanged({ images: body.images, existingImages: existing?.photos ?? [], scope }) &&
        areImagesOwnedOrUnchanged({ images: body.propertyPlan, existingImages: existing?.propertyPlan ?? [], scope })
    if (!imagesAllowed) throw new ClientListingError("validationFailed", 400)

    return taxonomy
}

// Fields a client may set. Everything agency-only is forced, whatever the request says.
export const buildClientListingData = body => ({
    ...buildCorePropertyFields(body),
    photos: body.images || null,
    propertyPlan: body.propertyPlan || null,
    status: PropertyStatus.PENDING,
    publishToFacebook: false,
    publishToHommex: false,
    verifiedByAgency: false,
})
